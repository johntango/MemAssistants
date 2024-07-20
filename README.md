# Assistant Manager Builder Mark 0.0.4

## Simulate Data Storage called MemAssistant that mimics MemGPT

We tell the LLM to store relevant facts by calling function store_in_memory
Presently it can also ask and answer a question but only from single document
Facts should be consolidated into documents with significant say about "John"
These documents could be attached to OpenAI Assistant's VectorDB or ChromaDB locally.
The advantage of OpenAI VectorDB is that it is integrated into our Assistant and has been tuned by them
The advantage of ChromaDB is it gives us more flexibility in interaction with other LLMS or Agents

Problem: store_in_memory does not have access to web-server data structure eg MEMORY. 
Can we pass pointer in when store_in_memory is called eg execute(memory, document, question)
At presen store_in_memory "regains" its state by reading in file. 

Install ChromaDB
npm install --save chromadb chromadb-default-embed 


jrw@mit.edu (email me if you find issues)
Thanks to following for their tools

## YouTube Video https://youtu.be/1dWdqAAOJeY

## References developersdigest/OpenAI_Function_Toolkit_And_Library

## Reference btg5679/javascript-openai-web-crawler

# Latest - upload file now takes a directory and will upload all files to a VectorDB

We are using GitHub Codespaces to develop this. So when you fork you may need to change the .devcontainer/devcontainer.json to point to your fork. We are using NPM and Node so run "npm install" to install all the dependencies. In the future you may need to modify the libraries to use the latest eg puppeteer
Similarly the openai API is changing fairly rapidly so monitor any deprecations of models
For example a number were deprecated on Jan 4, 2024

# Note on Scope

We now allow many active Assistants but with one assistant in "Control"
Note that to attach a file to an Assistant it must have either "retrieve" or "code_interpret" capabilities. At present we create every Assistant with both capabilities.

Tools to write and read data from permanent memory in style of memGPT added
Data written to file memory.json in format [{"name", "My name is John"}]
Data read back by searching for "name" in array

### Tools: To add functions as tools put them into the "function" sub-directory

All functions in that directory will be loaded to the assistant. We use the style proposed by developersdigest/OpenAI_Function_Toolkit_And_Library You must have both "execute" and "details" variables This allows us to dynamically call functions that the LLM requests

# Keys

First get Keys for OPEANAI_API_KEY and put it in GitHub Secrets for Codespaces
To run the OpenWeather Tool you'll need WEATHER_API_KEY

# Typical Run

A typical run first run the web server "node server.js". This should popup a browser window with the Assistant on port 3000 or 4000. There are rows of buttons.

### Assistants

The first row is for the Assistant. Click Create Assistant to create a new Assistant (after the first time you can just use List to load an existing Assistant) You should see the Assistant_ID in the output.

#### Note that Assistants can be called as named Tools by wrapping them in "execute" function. See Critic.js and Writer.js which call Assistants of the same name.

### Multi-Assistants and AgentMaker

#### AgentMaker

We now have an "AgentMaker" assistant creates a new Assistants and wraps them up as Tools/Functions that the Control Agent can call. The AgentMaker is called by the LLM when you send a message "Create Agent named XXX that is an expert on YYY" to the Control Asssistant. It will then trigger the AgentMaker Assistant to create a new Assistant and add it to the Function list. This means that the LLM can create Agents/Assistants for itself and then execute them. (This is a big deal)

#### ToolMaker

We also have "toolmaker" that can create "tool" functions that execute a specific task. Every tool must have an async function called "execute" that has a schema called "details". The schema requires all arguments be wrapped into an object but when the "execute" function is called the items in the object are unwrapped and passed in a JS list/array (needs to be thought out better).
Toolmaker writes the js file in "write_run_named_assistant.js" so this may need to be edited. The tool itself

### Files

For now don't load a file. You can load a file later. Its a two step process. First Create and then Attach to an Assistant.

### Threads

Next create a Thread - you should see the Thread_ID in the output. We use a single thread but you can run more. We place messages onto a thread and responses are added to the thread.

### Tools

Now go to Add Tools which will add all the Tools in the function directory + the Retrieval and Code Interpret tools

### Messages

Now create a Message. Try this one "What is the weather in Boston?"

### Runs

Now create a Run which will send the the Message on the Thread to OpenAI.

#### Runs Get Status

Get Status polls every 1/2 second to see if GPT is finished. It also executes any requests from the GPT to run tools. You can see in the Terminal Window when it is running tools locally.
Now click Get Message to retrieve any messages on the Thread. You should see the answer to the question.

### Debug

At present I have a lot of debug messages to the console. I will remove them in the future.

### GPT Output (Green Area)

Also there are messages from GPT that are outputted at the botthom of the page in the green area.
I give examples of functions you might want to load such as "take screenshot of a web site"
OpenWeather function - try "What is the weather in Boston?" The openweather function is a simple function that uses the openweather API to return the weather for a city. It is a simple example of how to use an API. You will need a key from openweather WEATHER_API_KEY to use it. You can get one for free at

#### https://openweathermap.org/api

# Functions/Tools

The most sophisticated is the crawlDomain function which will crawl the web to find answers to questions.
Try "Crawl the Lunarmail.io web site and answer the question "What products does Lunarmail offer?"
Its modified from btg5679/javascript-openai-web-crawler It will answer question if possible from
stored embeddings. If not it will crawl the web to find the answer. It makes use of RAG to embed the question ## ## tokens and compare them to the embeddings of the web pages. It uses GPT to figure out "Key" tokens in the question. ## It will then use the best match to answer the question. If it can't find an answer it will use GPT to generate an ## answer. It will then store the answer in the database for future use. You may want to delete crawled_urls.csv and contents.csv to start fresh.

# Digital Human Creation - Lets provide Functions the LLM can call (Initially we will call them by hand)

### Video transcript generation from mp4 video - OpenAI Whisper

### Voice cloning (11Eleven AI) use their API to create voice clone.

### Digital Face HeyGen API
