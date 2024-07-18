// this is the function that creates a specialized agent on OpenAI Platform
// 
import OpenAI from 'openai';
import { write_assistant_function } from '../workerFunctions.js';
const execute = async (name, instructions) => {
    // this creates a new agent
    let tools = [];
    
    const openai = new OpenAI({
        apiKey: process.env.OPENAI_API_KEY,
    });


    let assistant = await openai.beta.assistants.create({
            name: name,
            instructions: instructions,
            tools: tools,
            model: "gpt-4-1106-preview",
        });
    let message = `Agent ${name} created and is ready to use.`
    console.log(message);
    write_assistant_function(name, instructions);
    return message;
};
 
const details = {
    "name": "agentmaker",
    "parameters": {
        "type": "object",
        "properties": {
            "name": {
                "type": "string",
                "description": "The name of the assistant to make eg critic"
            },
            "instructions": {
                "type": "string",
                "description": "The system level instructions for the agent."
            }
        },
        "required": ["name", "instructions"]
    },
    "description": "This is an agent creator",
};
export { execute, details };