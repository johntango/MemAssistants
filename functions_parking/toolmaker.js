
    import OpenAI from 'openai';
    import fs from 'fs';
    import { get } from 'http';
    import { run_named_assistant, write_tool_function} from '../workerFunctions.js';

    const execute = async (name, instructions) => {
        let messages = await run_named_assistant("toolmaker", instructions);
        let message = messages[0];
        // delete everything in message up to and inclusing the first ```
        message = message.split('```').slice(1).join('```');
        // delete everything after the last including the last ```
        message = message.split('```').slice(0, -1).join('```');
        // delete up to async but keep async
        message = message.split('async').slice(1).join('async');

        console.log(`output from toolmaker ${message}`)
        // this writes the tool function to the file
        write_tool_function(name, message);
        console.log(`wrote tool function ${name}`)
        return messages;
    }

    const details = {
        "name": "toolmaker",
        "parameters": {
        "type": "object",
        "properties": {
            "name": {
            "type": "string",
            "description": "The name of the assistant. eg toolwriter"
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
        "description": "This is a toolmaker assistant that follows instructions"
    }
    export { execute, details }; 