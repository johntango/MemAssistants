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
import { memory_db } from "../server.js";

const MAXCOUNT = 10;
// given an optional document to store and/or a question to answer 
// URL is the document_id  in csv table with URL     CONTENT
// The embeddings will be stored in csv with URL     EMBEDDING or as Dictionary in memory [{url: embedding}, {...}]
// tokens are just words 
// DocIds/Fact_Ids will be integers 0,1,2 etc
// Facts will be created based on solely on LLM (store_in_memory function call xxxx)

// the function has access to SQLITE3 database to store the embeddings and tokens via global variable db

const execute = async ( document, question) => {
    dotenv.config();
    const inputText = question;
    // get OPENAI_API_KEY from GitHub secrets
    const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
    const openai = new OpenAI({ apiKey: OPENAI_API_KEY });

    // memory store location
    const contentsOutputPath = path.join(process.cwd(), "contents.csv");
    console.log("contentsOutputPath", contentsOutputPath);
    
    // retrieve stored documents and push into contents {url, tokens, embedding}
    let contents = [];
    let nextUrl = 0;
    let crawledData = { contents: [] };
    try{

        // This is if we want to read from a csv file

        await new Promise((resolve) => {
            fs.createReadStream(contentsOutputPath)
                .pipe(csvParser())
                .on("data", (data) => {
                    contents.push({
                        url: data.URL,
                        tokens:
                            typeof data.Content === "string"
                                ? data.Content
                                : data.Content.toString(),
                        embedding: data.Embedding,
                    });
                  
                    nextUrl = contents.length;
                })
                .on("end", () => {
                    crawledData.contents = contents;
                    console.log("Loaded contents from file.");
                    resolve();
                });
        });
    
        // get sqlite3 data and push into contents
        
        //contents = await readDB(memory_db);
        // get last url
        nextUrl = contents.length; // should be zero based id
        let documentEmbedding = [];
        if (document != null){
            documentEmbedding = await getEmbeddings(document);
        }
        let isoString = Dayjs().format();
        if (question == "") question = "The Universe and Everything";
        let fact = {url: nextUrl, date: isoString, entity: question, tokens: document, embeddings: documentEmbedding };
        //await insertDB(memory_db, fact);

        // add fact to memory 
        addDocumentToMemory(fact);
        
        //contents = await readDB(memory_db);
        // need to make sure that the contents are in the correct format for crawledData [{ url, tokens, embedding }]

        crawledData.contents = contents;
        
        console.log("finished add document to memory ...");
    } catch (error) {
        // if no csv file found create it 
            console.log("CSV files not found. Crawling domain...", error);
    }
    
    /*  This is the code for a database
    async function readDB(db) {
        const sql = 'SELECT * FROM agent_memory';
        let contents = [];
        return new Promise(function(resolve,reject){
            db.all(sql, function(err,rows){
               if(err){return reject(err);}
               resolve(rows);
             });
        });
    }
    async function insertDB(db, data) {
        const sql = `
            INSERT INTO agent_memory (url, date, entity, tokens, embeddings) 
            VALUES (?, ?, ?, ?, ?)
        `;
        let isoString = Dayjs().format();
        db.run(sql, [data.url, isoString, data.entity, data.tokens, data.embeddings], function (err) {
            if (err) {
                return console.error("Error inserting data:", err.message);
            }
            console.log(`Row inserted with ID: ${this.lastID}`);
        });
        
    }
    */
    
    async function addDocumentToMemory(newFact) {
    
            crawledData.contents.push(newFact);

            // Save crawled contents to CSV file
            
            const csvWriter = createCsvWriter.createObjectCsvWriter({
                path: contentsOutputPath,
                header: [
                    { id: "url", title: "URL" },
                    { id: "content", title: "Content" },
                    { id: "embedding", title: "Embedding" },
                ],
            });
            const records = crawledData.contents.map(({ url, tokens, embedding }) => ({
                url,
                content: typeof tokens === "string" ? tokens : tokens.join(" "),
                embedding: embedding
            }));
            await csvWriter.writeRecords(records);
            console.log(`New contents saved to ${contentsOutputPath}`);
    
    }

    async function tokenizeContent(content) {
        const cleanContent = removeHTMLElementNamesFromString(content);
        const tokenizer = new natural.WordTokenizer()
        const tokens = tokenizer.tokenize(cleanContent);
        return tokens.slice(0, 3000);
    }

    function removeHTMLElementNamesFromString(stringContent) {
        const regex =
            /\b(div|span|li|a|ul|section|script|footer|body|html|link|img|href|svg|alt|target|js|javascript|lang|head|gtag|meta|charset|utf|woff2|crossorigin|anonymous|link|rel|preload|as|font|href|assets|fonts|Inter|UI|var|woff2|type|font|css|stylesheet|text)\b/g;
        return stringContent.replace(regex, "");
    }


    /**
     * Takes a set of tokens as input.
     * Returns an array of the most relevant tokens.
     * @param {string[] | string} tokens - The set of tokens.
     * @returns {string[]} The array of the most relevant tokens.
     */
    async function getRelevantTokens(tokens) {
        console.log("start getRelevantTokens");
        const tokenString = typeof tokens === "string" ? tokens : tokens.join(" ");
        // Prepare the prompt for OpenAI's Codex
        const promptStart = `Given the following tokenized text, identify the most relevant tokens:\n\n`;
        const promptEnd = `\n\nRelevant tokens:`;

        // calculate the tokens available for the actual content
        const availableTokens = 4096 - promptStart.length - promptEnd.length;

        let prompt;
        if (tokenString.length > availableTokens) {
            // cut the string to fit available tokens
            prompt = promptStart + tokenString.slice(0, availableTokens) + promptEnd;
        } else {
            prompt = promptStart + tokenString + promptEnd;
        }

        // Call the OpenAI API
        let response;
        try {
            console.log("initiating openai api call");
            response = await openai.completions.create({
                model: "gpt-3.5-turbo-instruct",
                prompt: prompt,
                max_tokens: 2000,
                n: 1,
                stop: null,
                temperature: 0.8,
            });
        } catch (e) {
            console.error(
                "Error calling OpenAI API getRelevantTokens completions.create:",
                e?.response?.data?.error
            );
            throw new Error(
                "Error calling OpenAI API getRelevantTokens completions.create"
            );
        }

        console.log("finished getRelevantTokens");

        // Extract and return the relevant tokens from the response
        const relevantTokensText = response?.choices[0].text.trim();
        const relevantTokens = relevantTokensText.split(" ");
        console.log(relevantTokens);
        return relevantTokens;
    }

    /**
     * Takes an array of tokenized contents and an output file path as input.
     * Saves the most relevant tokens to a CSV file.
     * @param {object[]} tokenizedContents - The array of tokenized contents.
     * @param {string} outputPath - The output file path.
     */
    async function saveRelevantTokensToCsv(tokenizedContents, outputPath) {
        console.log("start saveRelevantTokensToCsv");
        const csvWriter = createCsvWriter.createObjectCsvWriter({
            path: outputPath,
            header: [
                { id: "url", title: "URL" },
                { id: "relevantTokens", title: "Tokens"},
                { id: "embedding", title: "Embedding" }
            ],
        });
        const records = [];

        for (const content of tokenizedContents) {
            const relevantTokens = await getRelevantTokens(content.tokens);
            records.push({
                url: content.url,
                relevantTokens: relevantTokens.join(" "),
            });
        }

        await csvWriter.writeRecords(records);
        console.log(`Relevant tokens saved to ${outputPath}`);
    }

    /**
     * Takes a set of tokens as input.
     * Returns an array of embeddings.
     * @param {string[]} tokens - The set of tokens.
     * @returns {number[][]} The array of embeddings.
     */
    async function getEmbeddings(tokens) {
        console.log("start getEmbeddings");
        // make tokens a string
        const tokenString = tokens.toString();

        let response;
        try {
            console.log("initiating openai api call");

            response = await openai.embeddings.create({
                model: "text-embedding-3-small",
                input: tokenString,
                embedding_format: "float"
            });
        } catch (e) {
            console.error("Error calling OpenAI API getEmbeddings:", e?.response?.data[0]);
            throw new Error("Error calling OpenAI API getEmbeddings");
        }

        return response.data[0].embedding;
    }

    /**
     * Takes two arrays of numbers as input.
     * Returns the cosine similarity between the two arrays.
     * @param {number[]} a - The first array of numbers.
     * @param {number[]} b - The second array of numbers.
     * @returns {number} The cosine similarity between the two arrays.
     */
    function cosineSimilarity(a, b) {
        if (!a || !b) return;
        //console.log("start cosineSimilarity", a, b);
        const dotProduct = a.reduce((sum, _, i) => sum + a[i] * b[i], 0);
        const magnitudeA = Math.sqrt(a.reduce((sum, val) => sum + val * val, 0));
        const magnitudeB = Math.sqrt(b.reduce((sum, val) => sum + val * val, 0));
        return dotProduct / (magnitudeA * magnitudeB);
    }

    /**
     * Takes an input text string and crawled data as input.
     * Returns an array of similarity scores along with their corresponding URLs.
     * @param {string} inputText - The input text string.
     * @param {object} crawledData - The crawled data.
     * @returns {object[]} The array of similarity scores along with their corresponding URLs.
     */
    async function calculateSimilarityScores(inputText, crawledData) {
        console.log("start calculateSimilarityScores");
        const inputTokens = await tokenizeContent(inputText);
        //const inputRelevantTokens = await getRelevantTokens(inputTokens);
        const inputEmbedding = await getEmbeddings(inputTokens);

        const similarityScores = [];

        for (const { url, tokens } of crawledData.contents) {
            // const relevantTokens = await getRelevantTokens(tokens);
            const contentEmbedding = await getEmbeddings(tokens);
            
            const similarityScore =
                cosineSimilarity(inputEmbedding, contentEmbedding) 
              
            similarityScores.push({ url, similarityScore });
        
        }

        console.log("finish calculateSimilarityScores");
        return similarityScores;
    }

    /**
     * Takes an input text string and crawled data as input.
     * Returns a string containing the answer to the input text question.
     * @param {string} inputText - The input text string.
     * @param {object} crawledData - The crawled data.
     * @returns {string} The answer to the input text question.
     */
    async function answerQuestion(inputText) {
        console.log("start answerQuestion");
        if (!inputText) inputText = "What is the Lunarmail answer to life, the universe and everything?";
        const similarityScores = await calculateSimilarityScores(
            inputText,
            crawledData
        );

        // Sort the similarity scores in descending order
        similarityScores.sort((a, b) => b.similarityScore - a.similarityScore);

        // Get the most relevant URL
        const mostRelevantUrl = similarityScores[0].url;
    
        console.log("mostRelevant Fact", crawledData.contents[mostRelevantUrl]);

        // Fetch the content of the most relevant URL
        let htmlContent;
        try {
            //response = await axios.get(mostRelevantUrl);
            htmlContent = crawledData.contents[mostRelevantUrl].tokens;
        } catch (e) {
            console.error("Error fetching URL:", mostRelevantUrl);
            throw new Error("Error fetching URL");
        }
        const strippedContent = stripHtmlTags(htmlContent);

        // Prepare the prompt for OpenAI's Codex
        const promptStart = `Answer the question based on the context below, and if the question can't be answered based on the context, say "I don't know"\n\nContext: ${strippedContent}\n\n---\n\nQuestion: ${inputText}\nAnswer:`;
        const availableTokens = 4096 - promptStart.length;

        let prompt;
        if (strippedContent.length > availableTokens) {
            // cut the string to fit available tokens
            prompt = `Answer the question based on the context below, and if the question can't be answered based on the context, make a guess"\n\nContext: ${strippedContent.slice(0, availableTokens)}\n\n---\n\nQuestion: ${inputText}\nAnswer:`;
        } else {
            prompt = promptStart;
        }

        // Call the OpenAI API
        let apiResponse;
        try {
            console.log("initiating openai api call");
            apiResponse = await openai.completions.create({
                model: "gpt-3.5-turbo-instruct",
                prompt: prompt,
                max_tokens: 2000,
                n: 1,
                stop: null,
                temperature: 1.0, //higher temp gives a more creative and diverse output
            });
        } catch (e) {
            console.error(
                "Error calling OpenAI API answerQuestion createCompletion:",
                e.response.data.error
            );
            throw new Error("Error calling OpenAI API answerQuestion createCompletion");
        }

        console.log("finish answerQuestion");
        // Extract and return the answer from the response
        const answer = apiResponse?.choices[0]?.text?.trim();
        return answer;
    }


    function stripHtmlTags(htmlContent) {
        // Regular expression to match HTML tags and other irrelevant content
        const regex = /(<([^>]+)>|\[.*?\])/gi;

        // Replace all matches with an empty string
        const strippedContent = htmlContent.replace(regex, "");

        // Return the stripped content
        return strippedContent;
    }

    if (question != ""){
        const answer = await answerQuestion(inputText,crawledData);
        console.log("Question", inputText);
        console.log("Answer:", answer);
        return `${inputText} gives this ${answer}`
    } else {
        console.log(`no question to answer`)
        return "No question to answer"
    }

}

const details = {
    "name": "store_in_memory",
    "parameters": {
        "type": "object",
        "properties": {
            "document": {
                "type": "string",
                "description": "The document to store"
            },
            "question": {
                "type": "string",
                "description": "The question to answer"
            }
        },
        "required": ["document", "question"]
    },
    "description": "Given either a document to store and question to answer, it generates and stores the tokens and embeddings, filters the most relevant document and answers the question"
};
export { execute, details };