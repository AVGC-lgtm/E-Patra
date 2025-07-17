// Load environment variables from the .env file
require('dotenv').config();
const axios = require('axios');

// Get the OpenAI API key from the environment variables
const apiKey = process.env.OPENAI_API_KEY;

// Function to interact with the GPT-4o Mini API
async function getGptResponse(prompt) {
  try {
    // Make a POST request to OpenAI API with GPT-4o Mini
    const response = await axios.post('https://api.openai.com/v1/completions', {
      model: 'gpt-4o-mini',  // Specify the GPT-4o Mini model
      prompt: prompt,
      max_tokens: 300,        // Adjust the output length (increased for more detail)
      temperature: 0.7,       // Adjust for creativity (lower for more deterministic results)
    }, {
      headers: {
        'Authorization': `Bearer ${apiKey}`,  // Pass the API key from the .env file
        'Content-Type': 'application/json'
      }
    });

    // Return the response text from the API
    return response.data.choices[0].text.trim();

  } catch (error) {
    // Catch and display any errors
    console.error('Error interacting with GPT-4o Mini:', error.response ? error.response.data : error.message);
    return null;
  }
}

// Example usage of the function
const prompt = "give me login and register api this code give me in node";
getGptResponse(prompt).then(response => {
  console.log("GPT-4o Mini Response:", response);
});
