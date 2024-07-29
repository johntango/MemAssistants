import axios from "axios";
import csvParser from "csv-parser";
import Dayjs from "dayjs";
import createCsvWriter from "csv-writer";
import dotenv from "dotenv";
import fs from "fs";
//import { createRequire } from  "module";
import path from "path";
import { URL } from "url";
import { parse } from "node-html-parser";
import natural from "natural";
//import WordTokenizer from "natural.WordTokenizer";
import { OpenAI } from "openai";
import { scratchdb} from "../server.js";
import { Server } from "http";

const MAXCOUNT = 10;


const execute = async ( action, key, value) => {

    dotenv.config();
    // get OPENAI_API_KEY from GitHub secrets
    const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
    const openai = new OpenAI({ apiKey: OPENAI_API_KEY });

    switch (action) {
        case 'set':
            // turn value json string into object if it is structured like json
            scratchdb[key] = value;
            return { message: `${scratchdb[key]}` };
        case 'get':
            if (scratchdb[key]) {
                return { message: `${scratchdb[key]}` };
            } else {
                return { message: 'Key not found' };
            }
        case 'getall':
            return { message:`${JSON.stringify(scratchdb)}`};
        case 'delete':
            if (scratchdb[key]) {
                delete scratchdb[key];
                return { message: 'Key deleted' };
            } else {
                return { message: 'Key not found' };
            }
        default:
            return { message: 'Unknown command' };
    }
    
}

const details = {
    "name": "scratchpad",
    "parameters": {
        "type": "object",
        "properties": {
            "action": {
                "type": "string",
                "description": "action is one of set, get, getall or delete"
            },
            "key": {
                "type": "string",
                "description": "The key to the entity"
            },
            "value": {
                "type": "string",
                "description": "The value as json string"
            }
        },
        "required": ["key", "value"]
    },
    "description": "Given an entity key and value, this function will store the value in the scratchpad"
};
export { execute, details };