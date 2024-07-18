// server.js is the main file that runs the server and handles the API requests. It uses the Express.js framework to create a web server and define routes for handling different API endpoints. The server.js file also includes functions to interact with the OpenAI API and execute tasks such as creating assistants, running assistants, and handling messages in a conversation thread.

import express from 'express';
import path from 'path';
const app = express();
const port = 4000;
import fs from 'fs';
import OpenAI from 'openai';
import { URL } from 'url';
import {openai, __dirname, focus, assistants, tools, get_and_run_tool, extract_assistant_id, create_or_get_assistant, create_thread, getFunctions} from './workerFunctions.js';
import { get } from 'http';
import { types } from 'util';

//import { OpenAI } from "@langchain/openai"
//const sqlite3 = require('sqlite3');


//const get_weather = require('./functions/get_weather.js');
 
// Serve static images from the 'images' folder

app.use(express.static(__dirname +'/images'));


// connect to db and get cursor
// Example usage:
//const dbPath = 'data/prompts.db';
//const db = getConnection(dbPath);


// Middleware to parse JSON payloads in POST requests
app.use(express.json());

// Serve index.html at the root URL '/'
//get the root directory

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, '/index.html')); 
});
//
// Run 
app.post('/run_assistant', async (req, res) => {
    let name = req.body.assistant_name;
    let instructions = req.body.message;
    if (instructions == "") {
        instructions = "You are a helpful assistant."
    }
    if (tools.length < 2) {
        //tools = [{ type: "code_interpreter" }, { type: "retrieval" }]
    }
    // this puts a message onto a thread and then runs the assistant on that thread
    let run_id;
    let messages = [];  // this accumulates messages from the assistant
    const openai = new OpenAI({
        apiKey: process.env.OPENAI_API_KEY,
    });
    let assistant = await create_or_get_assistant(name);
    let thread = await create_thread()

    focus.assistant_id = assistant.id;
    focus.thread_id = thread.id;
    focus.assistant_name = assistant.name;
    messages = await runAssistant(focus.assistant_id, focus.thread_id, instructions);
    res.status(200).json({ message: JSON.stringify(messages), focus: focus });
});



// Define routes
app.post('/create_assistant', async (req, res) => {
    // we should define the system message for the assistant in the input
    let system_message = req.body.system_message;
    let name = req.body.assistant_name;
    let instruction = "you are a helpful tool calling assistnt."
    try {
        let assistant = await create_or_get_assistant(name, instruction);
        let assistant_id = assistant.id;

        message = "Assistant created with id: " + assistant_id;
        res.status(200).json({ message: message, focus: focus });
    }
    catch (error) {
        return console.error('Error:', error);
    }
}
)
// get assistant by name
app.post('/get_assistant', async (req, res) => {
    let name = req.body.assistant_name;
    let instruction = "";
    let assistant = await create_or_get_assistant(name, instruction);
    focus.assistant_name = assistant.name;
    focus.assistant_id = assistant.id;
    console.log('Modify request received:', req.body);
    let message = `got Assistant ${name} :` + JSON.stringify(assistant);
    res.status(200).json({ message: message, focus: focus });
});

// this lists out all the assistants and extracts the latest assistant id and stores it in focus
app.post('/list_assistants', async (req, res) => {
    try {
        const response = await openai.beta.assistants.list({
            order: "desc",
            limit: 10,
        })
        console.log(`list of assistants ${JSON.stringify(response.data)}`);
        focus.assistant_id = extract_assistant_id(response.data).assistant_id;
        let message = JSON.stringify(response.data);
        res.status(200).json({ message: message, focus: focus });
    }
    catch (error) {
        return console.error('Error:', error);
    }
})


app.post('/delete_assistant', async (req, res) => {
    try {
        let assistant_id = req.body.assistant_id;
        console.log("Deleting assistant_id: " + assistant_id);
        const response = await openai.beta.assistants.del(assistant_id);

        // Log the first greeting
        console.log(
            `deleted assistant ${JSON.stringify(response)}.\n`
        );
        message = "Assistant deleted with id: " + assistant_id;
        focus.assistant_id = "";
        res.status(200).json({ message: message, focus: focus });
    }
    catch (error) {
        return console.error('Error:', error);
    }
});

// This uploads all files in a directory to a vectordb attached to an Assistant
app.post('/upload_files', async (req, res) => {

    let dirname = req.body.dir_path
    let files = [];
        // get list of files from directory
    fs.readdirSync(dirname).forEach(file => {
        files.push(`${dirname}/${file}`)
    });
    if (files.length<1) {
        return res.status(400).send('No files were uploaded.');
    }
    try {
        // loop over filelist and create a stream for each file
        const fileStreams = files.map((path) =>
            fs.createReadStream(path),
        );
        // get all files in the assistant
 
        //let vectordb_id = "vs_2IALcdUrUzzG8gMCXUdSHLqh";
        // Create a vector store including our two files.
        let fileIds = [];
        let vectorStore = await openai.beta.vectorStores.create({
         name: "CrewAI Docs01",
        });
        // get the vector store by its id
        //vectorStore = await openai.beta.vectorStores.retrieve(vectordb_id);
        let response = await openai.beta.vectorStores.fileBatches.uploadAndPoll(
         vectorStore.id, {files:fileStreams});
          
        let message = "Files uploaded: " + JSON.stringify(response);
        res.status(200).json({ message: message, focus: focus });
    }
    catch (error) {
        console.log(error);
        res.status(500).json({ message: 'Upload action failed' });
    }
});

// typical purpose to upload a file to an assistant say for a code interpreter analysis
app.post('/create_file', async (req, res) => {

    let data = req.body;
    // get the assistant id from the request as a string
    let assistant_id = data.assistant_id;
    // check that this assistant has either retrieve or code_interpreter active
    if (check_assistant_capability() == true) {
        // read the file
        console.log("in create_file assistant_id: " + assistant_id + " file path: " + data.dir_path);
        //let file_id = fs.createReadStream(data.dir_path);
        
        try {
            const response = await openai.files.create({
                file: fs.createReadStream(data.dir_path),
                purpose: "assistants",
              });

            let message = "File Attached to assistant: " + JSON.stringify(response);
            focus.file_id = response.id;
            res.status(200).json({ message: message, focus: focus });
        }
        catch {
            message = "Assistant needs to have retrieve or code_interpreter active"
            res.status(200).json({ message: message, focus: focus })
        }
    }
});
// this takes all files in a directory and feeds them to whisper to create a single transcription but with each document given metadata header
app.post('/run_whisper', async (req, res) => {
    let dirname = req.body.dir_path
    let types = ["wav", "mp3", "mp4"]
    let files = get_files_from_directory(dirname, types);
        // get list of files from directory
   
    if (files.length<1) {
        return res.status(400).send('No files were uploaded.');
    }
    try {
        // loop over filelist and create a stream for each file
        // output all text into one file
        let output_text = "";
        for (let file of files) {
            let filestream = fs.createReadStream(file);
        
            let transcription = await openai.audio.transcriptions.create({
                file: filestream,
                model: "whisper-1"
                }
            )
            // we need to give each transcription a header and keywords to make it useful
            let metadata = await generateMetadata(transcription.text);

            output_text += metadata;
        }
        // write the output text to a file
        fs.writeFileSync("transcription.txt", output_text);
    } catch (error) {
        console.log(error);
        res.status(500).json({ message: 'Whisper action failed' });
    }

});
async function get_files_from_directory(dirname, types) {

    let files = [];
    // get list of files from directory
    fs.readdirSync(dirname).forEach(file => {
        // filter for audio files in types
        if (types.includes(file.split('.').pop())) {
            files.push(`${dirname}/${file}`);
        }
    });
    return files;
}
// hit LLM to generate metadata for text input 
async function generateMetadata(textContent) {
    if (textContent.length < 100) {
        console.log(`Text is too short to generate metadata`);
        return null;
    }
  const prompt = `Generate metadata for the following text with author as John R Williams unless another author is found:\n\n${textContent}`;
  
  try {
    const response = await openai.completions.create({
        model: "gpt-3.5-turbo-instruct", 
        prompt: prompt,
        max_tokens: 200,  // Adjust the token count based on your needs
        temperature: 0.7,
    });
    let message = `Metadata: \n  ${response.choices[0].text} \n\n Original Text: \n ${textContent}`;
    
    return message
  } catch (error) {
    console.error(`Error generating metadata: ${error.message}`);
    return null;
  }
}
// check the active assistant (we only allow one to be active at present)
function check_assistant_capability() {
    if (tools[0].type == "code_interpreter" || tools[0].type == "retrieval") {
        return true
    }
    else { return false }
}
// get the news are write to news directory
app.post('/news_path', async (req, res) => {
    let dirname = req.body.dir_path;
    let topic = req.body.news_path;
// get news from newsapi and write to a file to news directory with name + date
    let news = await get_news(topic);
    let date = new Date();
    let filename = `${dirname}/news_${date}.txt`;
    // write or create file and write 
    fs.writeFileSync(filename, news);

    res.status(200).json(  {"message": `News written to file:  ${filename}`});
})
async function get_news(topic){
   
    let api_key = process.env.NEWSAPI_API_KEY;
    const url = `https://newsapi.org/v2/top-headlines?country=us&apiKey=${api_key}`;
  try {
    const response = await fetch(url);
    const data = await response.json();
    return JSON.stringify(data.articles);
  }
    catch (error) {
        console.error("Error occurred while getting country:", error);
        throw error;
    }
}

app.post('/list_files', async (req, res) => {

    let data = req.body;
    let assistant_id = data.assistant_id;
    try {
        let response = await openai.beta.assistants.files.list(
            assistant_id
        )
        message = response;
        console.log("list_files response: " + JSON.stringify(response));
        // check if files exist
        if (response.data.length > 0) {
            focus.file_id = response.data[0].id;
        }

        res.status(200).json({ message: message, focus: focus });
    }
    catch (error) {
        console.log(error);
        res.status(500).json({ message: 'List files action failed' });
    }
});

app.post('/delete_file', async (req, res) => {
    let data = req.body;
    let assistant_id = data.assistant_id;
    let file_id = data.file_id;
    try {
        let response = await openai.beta.assistants.files.del(
            assistant_id,
            file_id
        )
        message = response;

        res.status(200).json({ message: message, focus: focus });
    }
    catch (error) {
        console.log(error);
        res.status(500).json({ message: 'List files action failed' });
    }
});

app.post('/create_thread', async (req, res) => {
    let assistant_id = req.body.assistant_id;
    try {
        let response = await openai.beta.threads.create(
            /*messages=[
            {
              "role": "user",
              "content": "Create data visualization based on the trends in this file.",
              "file_ids": [focus.file_id]
            }
          ]*/
        )

        let message = response;
        console.log("create_thread response: " + JSON.stringify(response));
        focus.thread_id = response.id;
        res.status(200).json({ message: message, focus: focus });
    }
    catch (error) {
        console.log(error);
        res.status(500).json({ message: 'Thread Create failed' });
    }
});

app.post('/delete_thread', async (req, res) => {
    let thread_id = req.body.thread_id;
    try {
        let response = await openai.beta.threads.del(thread_id)
        message = "Thread deleted with id: " + response.id;
        focus.thread_id = ""
        res.status(200).json({ message: message, focus: focus });
    }
    catch (error) {
        console.log(error);
        res.status(500).json({ message: 'Thread Delete failed' });
    }
});

app.post('/create_run', async (req, res) => {
    let thread_id = req.body.thread_id;
    let assistant_id = req.body.assistant_id;
    console.log("create_run thread_id: " + thread_id + " assistant_id: " + assistant_id);
    try {
        let response = await openai.beta.threads.runs.create(thread_id, {
            assistant_id: assistant_id
        })
        focus.run_id = response.id;
        console.log("create_run response: " + JSON.stringify(response));
        res.status(200).json({ message: JSON.stringify(response), focus: focus });
    }
    catch (error) {
        console.log(error);
        res.status(500).json({ message: 'Run Delete failed' });
    }
});
//
// this is the main loop in handling messages calling functions etc
//
app.post('/run_status', async (req, res) => {
    let thread_id = req.body.thread_id;
    let run_id = req.body.run_id;
    try {
        let response = await openai.beta.threads.runs.retrieve(thread_id, run_id)
        let message = response;
        focus.status = response.status;
        let tries = 0;
        while (response.status == 'in_progress' && tries < 10) {
            await new Promise(resolve => setTimeout(resolve, 2000)); // Wait for 1 second
            response = await openai.beta.threads.runs.retrieve(thread_id, run_id);
            tries += 1;
        }
        if (response.status === "requires_action") {
            get_and_run_tool(response);
        }

        if (response.status == "completed" || response.status == "failed") {
            let message = "Completed run with status: " + response.status;
            res.status(200).json({ message: message, focus: focus });
        }

    }
    catch (error) {
        console.log(error);
        res.status(500).json({ message: 'Run Status failed' }, focus);
    }
})

app.post('/delete_run', async (req, res) => {
    let thread_id = req.body.thread_id;
    let assistant_id = req.body.assistant_id;
    let run_id = req.body.run_id;
    try {
        let response = await openai.beta.threads.runs.cancel(thread_id, run_id)
        message = response;
        focus.run_id = response.id;
        res.status(200).json({ message: message, focus: focus });
    }
    catch (error) {
        console.log(error);
        res.status(500).json({ message: 'Run Delete failed' });
    }
});
app.post('/create_message', async (req, res) => {
    let prompt = req.body.message;
    let thread_id = req.body.thread_id;
    console.log("create_message: " + prompt + " thread_id: " + thread_id);
    try {
        let response = await openai.beta.threads.messages.create(thread_id,
            {
                role: "user",
                content: prompt,
            })
        let message = await response;
        console.log("create message response: " + JSON.stringify(response));
        res.status(200).json({ message: message, focus: focus });
    }
    catch (error) {
        console.log(error);
        res.status(500).json({ message: 'Create  Message failed' });
    }
});


app.post('/get_messages', async (req, res) => {
    let thread_id = focus.thread_id;
    let run_id = focus.run_id;
    console.log("get_messages: on thread_id: " + thread_id + " run_id: " + run_id);
    try {

        await get_run_status(thread_id, run_id);
        // now retrieve the messages
        let response = await openai.beta.threads.messages.list(thread_id)
        let all_messages = get_all_messages(response);
        res.status(200).json({ message: all_messages, focus: focus });
    }
    catch (error) {
        console.log(error);
        res.status(500).json({ message: 'Get messages failed' });
    }
});
function get_all_messages(response) {
    let all_messages = [];
    let role = "";
    let content = "";
    for (let message of response.data) {
        // pick out role and content
        role = message.role;
        content = message.content[0].text.value;
        all_messages.push({ role, content });
    }
    return all_messages
}
//
// this puts a message onto a thread and then runs the assistant 
async function runAssistant(assistant_id, thread_id, user_instructions) {
    try {
        await openai.beta.threads.messages.create(thread_id,
            {
                role: "user",
                content: user_instructions,
            })
        let run = await openai.beta.threads.runs.create(thread_id, {
            assistant_id: assistant_id
        })
        let run_id = run.id;
        focus.run_id = run_id;
        focus.assistant_id = assistant_id;
        focus.thread_id = thread_id;
        await get_run_status(thread_id, run_id); // blocks until run is completed
        // now retrieve the messages
        let response = await openai.beta.threads.messages.list(thread_id)
        return get_all_messages(response);

    }
    catch (error) {
        console.log(error);
        return error;
    }
}
async function get_run_status(thread_id, run_id) {
    try {
        let response = await openai.beta.threads.runs.retrieve(thread_id, run_id)
        let message = response;
        focus.status = response.status;
        let tries = 0;
        while (response.status == 'in_progress' || response.status == "queued" && tries < 10) {
            await new Promise(resolve => setTimeout(resolve, 2000)); // Wait for 1 second
            response = await openai.beta.threads.runs.retrieve(thread_id, run_id);
            tries += 1;
        }
        if (response.status === "requires_action") {
            get_and_run_tool(response);
        }

        if (response.status == "completed" || response.status == "failed") {

        }
        // await openai.beta.threads.del(thread_id)
        return
    }
    catch (error) {
        console.log(error);
        return error;
    }
}


//
// add all messages to array
//
function addLastMessagetoArray(message, messages) {
    if (message !== undefined) {
        role = message.data[0].role;
        content = message.data[0].content[0].text.value;
        messages.push({ role, content });
    }
}
// Langchain version of Loop
app.post('/loopLC', async (req, res) => {
    let thread_id = focus.thread_id;
    let writer = assistants.Writer;
    let critic = assistants.Critic;
    let messages = [];
    try {
        // Create a LangChain instance
        const chain = new LangChain();

        // Run the Writer Assistant to create a first draft
        chain.addAssistant(writer.id);
        chain.addInstruction("Write a paragraph about a king and his gaudy clothes");
        await chain.run(thread_id);
        await get_run_status(thread_id, focus.run_id, messages);

        // Run the Critic Assistant to provide feedback
        chain.addAssistant(critic.id);
        chain.addInstruction("Provide constructive feedback to what the Writer assistant has written");
        await chain.run(thread_id);
        await get_run_status(thread_id, focus.run_id, messages);

        // Have the Writer Assistant rewrite the first chapter based on the feedback from the Critic
        chain.addAssistant(writer.id);
        chain.addInstruction(`Using the feedback from the Critic Assistant rewrite the first chapter given here: ${messages[0]}`);
        await chain.run(thread_id);
        await get_run_status(thread_id, focus.run_id, messages);

        // create one message with all the messages input to the thread
        let textMessage = messages.join("\n");

        res.status(200).json({ message: JSON.stringify(textMessage), focus: focus });
    } catch (error) {
        console.log(error);
        res.status(500).json({ error: "An error occurred" });
    }
});

app.post('/loop', async (req, res) => {
    let thread_id = focus.thread_id;
    let writer = assistants.Writer;
    let critic = assistants.Critic;
    let messages = [];
    try {
        // Run the Writer Assistant to create a first draft                      
        await runAssistant(writer.id, thread_id, "Write a paragraph about a king and his gaudy clothes")
        await get_run_status(thread_id, focus.run_id, messages)

        // Run the Critic Assistant to provide feedback 
        await runAssistant(critic.id, thread_id, `Provide constructive feedback to what the Writer assistant has written`)
        await get_run_status(thread_id, focus.run_id, messages)

        // Have the Writer Assistant rewrite the first chapter based on the feedback from the Critic        
        await runAssistant(writer.id, thread_id, `Using the feedback from the Critic Assistant rewrite the first chapter given here: ${messages[0]}`)
        await get_run_status(thread_id, focus.run_id, messages)

        // create one message with all the messages input to the thread
        let textMessage = messages.join("\n")

        res.status(200).json({ message: JSON.stringify(textMessage), focus: focus })
    }
    catch (error) {
        console.log(error);
        res.status(500).json({ message: 'Get messages failed' });
    }
});
// some code that might be useful
//messages.append({"role": "tool", "tool_call_id": assistant_message["tool_calls"][0]['id'], "name": assistant_message["tool_calls"][0]["function"]["name"], "content": results})

async function get_tools(assistant_id) {
    let response = await openai.beta.assistants.retrieve(assistant_id);
    let tools = response.tools;
    return tools;
}
//
// this is used to add tools to an assistant and to a thread
// its best to create a new thread at this time as well 
// This means any previous context is lost
//
app.post('/list_tools', async (req, res) => {
    let assistant_id = focus.assistant_id;
    const functions = await getFunctions();

    let local_tools = [];
// lets just add all the tools to the assistant
    //let tools = await get_tools(assistant_id);
    
    let keys = Object.keys(functions);
    for (let key of keys) {
        let details = functions[key].details;
        // check if the function is already in the tools
        let found = false;
        /* for (let tool of tools) {
            if (tool.function.name == key) {
                found = true;
                break;
            }
        }
        */
       // push all tools into local_tools
        if (!found) {
            local_tools.push({ "type": "function", "function": details })
        }
    }
    let response = ""
    // add the tools to the assistant if they are not already there
    if (local_tools.length > 0) {
        response = await openai.beta.assistants.update(
            assistant_id,
            { "tools": local_tools }
        )
        console.log("assistant with tools updated: " + JSON.stringify(response));
    }
  
    //focus.func_name = "crawlDomainGenEmbeds";
    res.status(200).json({ message: JSON.stringify(response), focus: focus });
})

app.post('/run_function', async (req, res) => {
    // Step 1: send the conversation and available functions to the model
    const messages = [
        { role: "user", content: "What's the weather like in San Francisco, Tokyo, and Paris?" },
    ];

    const response = await openai.chat.completions.create({
        model: "gpt-3.5-turbo-1106",
        messages: messages,
        tools: tools,
        tool_choice: "auto", // auto is default, but we'll be explicit
    });
    const responseMessage = await response.choices[0].message;
    res.status(200).json({ message: responseMessage, focus: focus });

});

app.post('/table', (req, res) => {
    const sql = "SELECT * FROM prompts";
    db.all(sql, [], (err, rows) => {
        if (err) {
            throw err;
        }
        rows.forEach((row) => {
            console.log(row);
        });
        res.status(200).json({ message: JSON.stringify(rows), focus: focus });
        //res.render('table', { rows });
    });
});


//this is where we write to the database
function insertIntoTable(db, data) {
    const sql = `
        INSERT INTO prompts (topic, sentiment, style, tone, language, prompt, response) 
        VALUES (?, ?, ?, ?, ?, ?, ?)
    `;
    db.run(sql, [data.topic, data.sentiment, data.style, data.tone, data.language, data.prompt, data.response], function (err) {
        if (err) {
            return console.error("Error inserting data:", err.message);
        }
        console.log(`Row inserted with ID: ${this.lastID}`);
    });
}

function getConnection(dbPath) {
    return new sqlite3.Database(dbPath, (err) => {
        if (err) {
            console.error("Error connecting to the database:", err.message);
        } else {
            console.log("Connected to the SQLite database.");
        }
    });
}
app.listen(port, () => {
    console.log(`Server running at http://localhost:${port}`);
});
