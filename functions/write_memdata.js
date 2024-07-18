// this is the function that writes data to memory 

import OpenAI from 'openai';
import fs from 'fs';
import { get } from 'http';

const execute = async (name, data) => {
    // check of memory.json exists and if not create it
    if (!fs.existsSync('memory.json')) {
        fs.writeFileSync('memory.json', '[]');
    }
    //read memory.json into local memory named memory
    let memory = fs.readFileSync('memory.json');
    memory = JSON.parse(memory);
    // insert data into memory
    memory.push({ [name]: data });
    // write memory back to memory.json
    fs.writeFileSync('memory.json', JSON.stringify(memory));

    console.log(`${name} written to memory`);
    return `${name} written to memory`
}
const details = {
    "name": "write_memdata",
    "parameters": {
        "type": "object",
        "properties": {
            "name": {
                "type": "string",
                "description": "The name of the data"
            },
            "data": {
                "type": "string",
                "description": "The data to write to memory."
            }
        },
        "required": ["name", "instructions"]
    },
    "description": "This is a critic of stories passed to it",
};
export { execute, details };