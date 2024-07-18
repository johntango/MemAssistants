// this is the function that runs the writer assistant
import OpenAI from 'openai';
import fs from 'fs';
import { get } from 'http';
import { run_named_assistant } from '../workerFunctions.js';

const execute = async (name, instructions) => {
    let message = await run_named_assistant("critic", instructions);
    return message;
}
const details = {
    "name": "critic",
    "parameters": {
        "type": "object",
        "properties": {
            "name": {
                "type": "string",
                "description": "The name of the assistant to use. eg critic"
            },
            "instructions": {
                "type": "string",
                "description": "The story and the instructions for the critic."
            }
        },
        "required": ["name", "instructions"]
    },
    "description": "This is a critic of stories passed to it",
};
export { execute, details };