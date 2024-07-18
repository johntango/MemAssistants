// this is the function that runs the writer assistant
//
import OpenAI from 'openai';
import fs from 'fs';
import { get } from 'http';
import { run_named_assistant } from '../workerFunctions.js';

const execute = async (name, instructions) => {
    let message = await run_named_assistant("writer", instructions);
    return message;
}

const details = {
    "name": "writer",
    "parameters": {
      "type": "object",
      "properties": {
        "name": {
          "type": "string",
          "description": "The name of the assistant to use. eg writer"
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
    "description": "This is a fiction writer that can write stories based on instructions"
  }
export { execute, details };