// this is the function that runs the writer assistant
import OpenAI from 'openai';
import fs from 'fs';
import { Server, get } from 'http';
import path from 'path';
import { URL } from 'url';
import {memory_db} from './server.js';


let assistants = {}
//let tools = [{ role:"function", type: "code_interpreter" }, { role:"function",type: "retrieval" }]
let tools = [];


const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
});
const __dirname = process.cwd();

// Define global variables focus to keep track of the assistant, file, thread and run
let focus = { assistant_id: "", assistant_name: "", dir_path: "",news_path:"", thread_id: "", message: "", run_id: "", run_status: "", vector_store_id:"" ,embed_type: "openai"}

// requires action is a special case where we need to call a function
async function get_and_run_tool(response) {
    let thread_id = focus.thread_id;
    let run_id = focus.run_id;
    // extract function to be called from response
    const toolCalls = response.required_action.submit_tool_outputs.tool_calls;
    let toolOutputs = []
    let functions_available = await getFunctions();
    for (let toolCall of toolCalls) {
        console.log("toolCall: " + JSON.stringify(toolCall));
        let functionName = toolCall.function.name;
        // get function from functions_available
        let functionToExecute = functions_available[`${functionName}`];

        if (functionToExecute.execute) {
            let args = JSON.parse(toolCall.function.arguments);
            let argsArray = Object.keys(args).map((key) => args[key]);
            // insert as first argument pointer to memoryDB
            // check if functionToExecute contains match to  store_in_memory   
            
            let functionResponse = await functionToExecute.execute(...argsArray);
            toolOutputs.push({
                tool_call_id: toolCall.id,
                output: JSON.stringify(functionResponse)
            });
            let text = JSON.stringify({ message: `function ${functionName} called`, focus: focus });
            await openai.beta.threads.runs.submitToolOutputs(
                thread_id,
                run_id,
                {
                    tool_outputs: toolOutputs
                }
            );
            console.log(`FunctionResponse from ${functionName }:  ${JSON.stringify(functionResponse)}`);
        }
        continue;
    }
}
function extract_assistant_id(data) {
    let assistant_id = "";
    if (data.length > 0) {
        assistant_id = data[0].id;
        tools = data[0].tools
        // loop over assistants and extract all the assistants into a dictionary
        for (let assistant of data) {
            assistants[assistant.name] = assistant;
        }
    }

    console.log("got assistant_id: " + assistant_id);
    return { assistant_id: assistant_id, tools: tools }
}

async function create_or_get_assistant(name, instructions) {
    const response = await openai.beta.assistants.list({
        order: "desc",
        limit: 20,
    })
    // loop over all assistants and find the one with the name name
    let assistant = {};
    for (let obj in response.data) {
        assistant = response.data[obj];
        // change assistant.name to small letters
        if(assistant.name != null){
            if (assistant.name.toLowerCase() == name.toLowerCase()) {
                focus.assistant_id = assistant.id;
                tools = assistant.tools;  // get the tool
                break
            }
        }
    }
    if (focus.assistant_id == "") {
        assistant = await openai.beta.assistants.create({
            name: name,
            instructions: instructions,
            tools: tools,
            model: "gpt-4-1106-preview",
        });
        focus.assistant_id = assistant.id
        focus.assistant_name = name;
    }
    return assistant;
}
// create a new thread

async function create_thread() {
        // do we need an intitial system message on the thread?
    let response = await openai.beta.threads.create(
            /*messages=[
            {
              "role": "user",
              "content": "Create data visualization based on the trends in this file.",
              "file_ids": [focus.file_id]
            }
          ]*/
        )
    focus.thread_id = response.id;
    return response;
}

async function getFunctions() {
    const files = fs.readdirSync(path.resolve(__dirname, "./functions"));
    const openAIFunctions = {};

    for (const file of files) {
        if (file.endsWith(".js")) {
            const moduleName = file.slice(0, -3);
            const modulePath = `./functions/${moduleName}.js`;
            const { details, execute } = await import(modulePath);

            openAIFunctions[moduleName] = {
                "details": details,
                "execute": execute
            };
        }
    }
    return openAIFunctions;
}

const run_named_assistant = async (name, instructions) => {
    // this puts a message onto a thread and then runs the assistant on that thread
    let assistant_id;
    let run_id;
    let messages = [];
    const openai = new OpenAI({
        apiKey: process.env.OPENAI_API_KEY,
    });

    // get a new thread to operate on
    let thread = await openai.beta.threads.create()
    let thread_id = thread.id;

    // get assistant id
    const response = await openai.beta.assistants.list({
        order: "desc",
        limit: 10,
    })
    // loop over all assistants and find the one with the name name
    for (let obj in response.data) {
        let assistant = response.data[obj];
        // change assistant.name to small letters
        if (assistant.name.toLowerCase() == name) {
            assistant_id = assistant.id;
            break
        }
    }


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
            run_id = run.id;
            get_run_status(thread_id, run_id, messages);
            let message = await openai.beta.threads.messages.list(thread_id)
            await addLastMessagetoArray(message, messages)
        }
        catch (error) {
            console.log(error);
            return error;
        }
    }
    async function get_run_status(thread_id, run_id, messages) {
        try {
            let runStatus = await openai.beta.threads.runs.retrieve(thread_id, run_id);
            while (runStatus.status !== 'completed') {
                await new Promise(resolve => setTimeout(resolve, 500)); // Wait for 1 second
                runStatus = await openai.beta.threads.runs.retrieve(thread_id, run_id);
            }

            //await openai.beta.threads.del(thread_id)
        }
        catch (error) {
            console.log(error);
            return error;
        }
    }
    async function addLastMessagetoArray(message, messages) {
        messages.push(message.data[0].content[0].text.value)
        console.log("PRINTING MESSAGES: ");
        console.log(message.data[0].content[0].text.value)
    }

    await runAssistant(assistant_id, thread_id, instructions);
    // delete the thread

    return messages;
}
const write_assistant_function = async (name, instructions) => {

    let text = `
    import OpenAI from 'openai';
    import fs from 'fs';
    import { get } from 'http';
    import { run_named_assistant } from '../write_run_named_assistant.js';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

    const execute = async (name, instructions) => {
        let message = await run_named_assistant("${name}", instructions);
        return message;
    }

    const details = {
        "name": "${name}",
        "parameters": {
        "type": "object",
        "properties": {
            "name": {
            "type": "string",
            "description": "The name of the tool. eg writer"
            },
            "instructions": {
            "type": "string",
            "description": "The instructions to the assistant. eg Write a story about a dog"
            }
        },
        "required": [
            "name",
            "instructions"
        ]
        },
        "description": "This is a ${name} assistant that follows instructions"
    }
    export { execute, details }; `

    // write a file with the name of the assistant
    fs.writeFile(`functions/${name}.js`, text, (err) => {
        if (err) throw err;
        console.log('The file has been saved!');
    });
    return `The ${name} assistant has been created.`
}
const write_tool_function = async (toolname, thefunc) => {

    let text = `
    ${thefunc}
    const details = {
        "name": "${toolname}",
        "parameters": {
            "type": "object",
            "properties": {
                "input": {
                    "type": "array",
                    "items": {
                        "type": "number"
                    },
                    "description": "An array of numbers to be summed."
                }
            },
        "required": ["input"],
        "description": "This function ${toolname} executes the task specified."
        }
    }

    const details = {
        "name": "${toolname}",
        "parameters": {
            "type": "array",
            "items": {
                "type": "number",
                "description": "Array of numbers to process"
            },
            "description": "An array of numbers for the tool to process"
        },
        "description": "This is a ${toolname} that processes an array of numbers and outputs a result as a string"
    }
    export { execute, details }; `

    // write a file with the name of the assistant
    fs.writeFile(`functions/${toolname}.js`, text, (err) => {
        if (err) throw err;
        console.log('The file has been saved!');
    });
    // load it into the tools 

    console.log( `The ${toolname} tool has been created.`);
}

// Function to read files from a directory and return their content
const readFilesFromDirectory = (directory) => {
  const files = fs.readdirSync(directory);
  return files.map((file) => {
    const filePath = path.join(directory, file);
    const content = fs.readFileSync(filePath, 'utf8');
    return { file, content };
  });
};

// Function to chunk text into smaller parts
const chunkText = (text, chunkSize = 500) => {
  const chunks = [];
  for (let i = 0; i < text.length; i += chunkSize) {
    chunks.push(text.substring(i, i + chunkSize));
  }
  return chunks;
};

// Function to embed text using sentence-transformers

// Function to embed text using OpenAI's embedding API
const embedChunks = async (chunks) => {
    let embeddings = await Promise.all(
      chunks.map(async (chunk) => {
        const response = await openai.embeddings.create({
            model: "text-embedding-3-small",
            input: chunk,
            embedding_format: "float"
        });
        //console.log("Embedding: " + response.data[0].embedding);
        return response.data[0].embedding;
      })
    );
    return embeddings;
  };
// Function to compute similarity between query and embeddings
const cosineSimilarity = (vecA, vecB) => {
  let dotProduct = 0.0;
  let normA = 0.0;
  let normB = 0.0;
  for (let i = 0; i < vecA.length; i++) {
    dotProduct += vecA[i] * vecB[i];
    normA += vecA[i] ** 2;
    normB += vecB[i] ** 2;
  }
  return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
};

// Function to find the most relevant chunks based on query
const findRelevantChunks = (queryEmbedding, chunkEmbeddings, topK = 3) => {
  const similarities = chunkEmbeddings.map(chunkEmbedding =>
    cosineSimilarity(queryEmbedding, chunkEmbedding)
  );
  const ranked = similarities
    .map((sim, idx) => ({ sim, idx }))
    .sort((a, b) => b.sim - a.sim)
    .slice(0, topK);
  return ranked.map(rank => rank.idx);
};

// Function to save embeddings and chunks to the Embed directory
const saveEmbeddings = (fileName, chunks, embeddings) => {
  const filePath = path.join('embed', `${fileName}.json`);
  const data = chunks.map((chunk, idx) => ({
    chunk,
    embedding: embeddings[idx]
  }));

  fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
};


export {openai, __dirname, focus, assistants, tools, get_and_run_tool, extract_assistant_id, create_or_get_assistant, create_thread, getFunctions, run_named_assistant, write_assistant_function, write_tool_function, readFilesFromDirectory, chunkText, embedChunks, cosineSimilarity, findRelevantChunks, saveEmbeddings};