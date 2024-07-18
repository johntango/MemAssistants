import fs from 'fs';
import fetch from 'node-fetch';
import OpenAI from 'openai';

import extractAudio from 'ffmpeg-extract-audio';

const execute = async (name, data) => {
    extractAudioFromVideo('./path_to_video.mp4', './path_to_output_audio.mp3');
}
async function extractAudioFromVideo(videoPath, outputPath) {
   try {
      await extractAudio({
         input: videoPath,
         output: outputPath
      });
      console.log('Audio extraction successful!');
   } catch (error) {
      console.error('Error extracting audio:', error);
   }
}

// Example usage

async function transcriptFileWithWhisper(pathToAudioFile){
    // get OPENAI_API_KEY from GitHub secrets
    const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
    const openai = new OpenAI({ apiKey: OPENAI_API_KEY });
    const transcript = await openai.createTranscription(
            fs.createReadStream(pathToAudioFile) ,
            'whisper-1',
            TEMPLATE_WHISPER_PROMPT,
            'verbose_json',
            0.7,
            'en',
            {
               maxContentLength: Infinity,
               maxBodyLength: Infinity,
            },
    );
    
    return transcript.data
 }
 
 const whisperResult = await transcriptFileWithWhisper('./path_to_output_audio.mp3');
 
 // After processing, don't forget to delete the audio file.
 fs.unlinkSync('./path_to_output_audio.mp3');

 const details = {
    "name": "videotranscription",
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
    "description": "This makes a transcription of a video file.",
};
export { execute, details };