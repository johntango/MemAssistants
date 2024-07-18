
async function execute(args) {
    let sum = 0;
    for (let i = 0; i < args.length; i++) {
        if (typeof args[i] !== 'number') {
            throw new Error(`Expected a number but received ${args[i]}`);
        }
        sum += args[i];
    }
  return sum.toString();
}

// Example usage:
// execute(1, 2, 3, 4).then(console.log);  // Output: '10'
// execute(10, 20, 30).then(console.log);   // Output: '60'
// execute(5, -5, 10).then(console.log);    // Output: '10'

const details = {
    "name": "sumbam",
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
    "description": "This function returns the sum of an array of numbers."
    }
}
export { execute, details }
