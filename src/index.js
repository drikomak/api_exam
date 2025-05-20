import 'dotenv/config'
import Fastify from 'fastify'
import swagger from '@fastify/swagger'
import swaggerUi from '@fastify/swagger-ui'
import axios from 'axios'
import { submitForReview } from './submission.js'

const fastify = Fastify({
  logger: true,
})

// Configure Swagger
fastify.register(swagger, {
  swagger: {
    info: {
      title: 'Exam API',
      description: 'API documentation for the MIASHS exam project.',
      version: '0.1.0',
    },
    externalDocs: {
      url: 'https://swagger.io',
      description: 'Find more info here',
    },
    host: process.env.RENDER_EXTERNAL_URL ? new URL(process.env.RENDER_EXTERNAL_URL).host : 'localhost:3000', // Adjust for Render
    schemes: [process.env.RENDER_EXTERNAL_URL ? 'https' : 'http'],
    consumes: ['application/json'],
    produces: ['application/json'],
  },
  // exposeRoute: true, // This is often needed to customize json path with ui
  // routePrefix: '/documentation' // Default if ui is not at root
})

fastify.register(swaggerUi, {
  routePrefix: '/', // Serve Swagger UI at the root
  // We need to tell swaggerUi where to get the json file
  swaggerOrigin: '/json', 
  uiConfig: {
    docExpansion: 'full',
    deepLinking: false,
  },
  staticCSP: true,
  transformStaticCSP: (header) => header,
})

// In-memory store for recipes
const recipesByCity = {};
let nextRecipeId = 1;

const CITY_API_URL = 'https://api-ugi2pflmha-ew.a.run.app/cities';
const WEATHER_API_URL = 'https://api-ugi2pflmha-ew.a.run.app/weather';

// Helper function to get city data
async function getCityData(cityId) {
  try {
    const response = await axios.get(`${CITY_API_URL}/${cityId}`);
    return response.data;
  } catch (error) {
    if (error.response && error.response.status === 404) {
      return null;
    }
    throw error; // Re-throw other errors
  }
}

// GET /cities/:cityId/infos
fastify.route({
  method: 'GET',
  url: '/cities/:cityId/infos',
  schema: {
    description: 'Get information for a specific city, including weather and recipes.',
    tags: ['cities'],
    params: {
      type: 'object',
      properties: {
        cityId: { type: 'string', description: 'ID of the city' }
      },
      required: ['cityId']
    },
    response: {
      200: {
        description: 'Successful response',
        type: 'object',
        properties: {
          coordinates: { 
            type: 'array', 
            items: { type: 'number' }, 
            minItems: 2, 
            maxItems: 2,
            description: '[latitude, longitude]' 
          },
          population: { type: 'integer' },
          knownFor: { type: 'array', items: { type: 'string' } },
          weatherPredictions: {
            type: 'array',
            minItems: 2,
            maxItems: 2,
            items: {
              type: 'object',
              properties: {
                when: { type: 'string', enum: ['today', 'tomorrow'] },
                min: { type: 'number' },
                max: { type: 'number' },
              },
              required: ['when', 'min', 'max']
            }
          },
          recipes: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                id: { type: 'integer' },
                content: { type: 'string' },
              },
              required: ['id', 'content']
            }
          }
        }
      },
      404: {
        description: 'City not found',
        type: 'object',
        properties: {
          error: { type: 'string' }
        }
      }
    }
  },
  handler: async (request, reply) => {
    const { cityId } = request.params;
    try {
      const city = await getCityData(cityId);
      if (!city) {
        reply.code(404).send({ error: 'City not found' });
        return;
      }

      const [weatherTodayRes, weatherTomorrowRes] = await Promise.all([
        axios.get(`${WEATHER_API_URL}?cityId=${cityId}&when=today`),
        axios.get(`${WEATHER_API_URL}?cityId=${cityId}&when=tomorrow`)
      ]);
      
      const weatherPredictions = [
        { when: 'today', ...weatherTodayRes.data },
        { when: 'tomorrow', ...weatherTomorrowRes.data }
      ];

      const cityRecipes = recipesByCity[cityId] || [];

      reply.send({
        coordinates: [city.coordinates.lat, city.coordinates.lon],
        population: city.population,
        knownFor: city.knownFor,
        weatherPredictions,
        recipes: cityRecipes,
      });
    } catch (err) {
      fastify.log.error(err);
      // Check if it's an axios error from weather API if city was found
      if (err.isAxiosError && err.config && err.config.url.includes(WEATHER_API_URL)) {
          // Handle cases where city exists but weather API fails for it
          // This could be due to various reasons, e.g. weather data not available for the city
          // For now, we'll send a 500, but a more specific error or partial response might be better.
          reply.code(500).send({ error: 'Failed to fetch weather data' });
          return;
      }
      reply.code(500).send({ error: 'Internal Server Error' });
    }
  }
})

// POST /cities/:cityId/recipes
fastify.route({
  method: 'POST',
  url: '/cities/:cityId/recipes',
  schema: {
    description: 'Add a recipe to a specific city.',
    tags: ['recipes'],
    params: {
      type: 'object',
      properties: {
        cityId: { type: 'string', description: 'ID of the city' }
      },
      required: ['cityId']
    },
    body: {
      type: 'object',
      properties: {
        content: { type: 'string', description: 'The recipe content' }
      },
      required: ['content']
    },
    response: {
      201: {
        description: 'Recipe created successfully',
        type: 'object',
        properties: {
          id: { type: 'integer' },
          content: { type: 'string' }
        }
      },
      400: {
        description: 'Bad request (e.g., invalid content)',
        type: 'object',
        properties: {
          error: { type: 'string' }
        }
      },
      404: {
        description: 'City not found',
        type: 'object',
        properties: {
          error: { type: 'string' }
        }
      }
    }
  },
  handler: async (request, reply) => {
    const { cityId } = request.params;
    const { content } = request.body;

    if (!content || content.trim() === '') {
      reply.code(400).send({ error: 'Recipe content cannot be empty' });
      return;
    }
    if (content.length < 10) {
      reply.code(400).send({ error: 'Recipe content must be at least 10 characters long' });
      return;
    }
    if (content.length > 2000) {
      reply.code(400).send({ error: 'Recipe content must be at most 2000 characters long' });
      return;
    }

    try {
      const city = await getCityData(cityId);
      if (!city) {
        reply.code(404).send({ error: 'City not found' });
        return;
      }

      if (!recipesByCity[cityId]) {
        recipesByCity[cityId] = [];
      }

      const newRecipe = {
        id: nextRecipeId++,
        content: content,
      };
      recipesByCity[cityId].push(newRecipe);

      reply.code(201).send(newRecipe);
    } catch (err) {
      fastify.log.error(err);
      reply.code(500).send({ error: 'Internal Server Error' });
    }
  }
})

// DELETE /cities/:cityId/recipes/:recipeId
fastify.route({
  method: 'DELETE',
  url: '/cities/:cityId/recipes/:recipeId',
  schema: {
    description: 'Delete a specific recipe from a city.',
    tags: ['recipes'],
    params: {
      type: 'object',
      properties: {
        cityId: { type: 'string', description: 'ID of the city' },
        recipeId: { type: 'integer', description: 'ID of the recipe' }
      },
      required: ['cityId', 'recipeId']
    },
    response: {
      204: {
        description: 'Recipe deleted successfully',
        type: 'null' // No content
      },
      404: {
        description: 'City or Recipe not found',
        type: 'object',
        properties: {
          error: { type: 'string' }
        }
      }
    }
  },
  handler: async (request, reply) => {
    const { cityId } = request.params;
    const recipeId = parseInt(request.params.recipeId, 10);

    try {
      const city = await getCityData(cityId);
      if (!city) {
        reply.code(404).send({ error: 'City not found' });
        return;
      }

      const cityRecipes = recipesByCity[cityId];
      if (!cityRecipes) {
        reply.code(404).send({ error: 'Recipe not found for this city' });
        return;
      }

      const recipeIndex = cityRecipes.findIndex(r => r.id === recipeId);
      if (recipeIndex === -1) {
        reply.code(404).send({ error: 'Recipe not found' });
        return;
      }

      recipesByCity[cityId].splice(recipeIndex, 1);
      reply.code(204).send();

    } catch (err) {
      fastify.log.error(err);
      reply.code(500).send({ error: 'Internal Server Error' });
    }
  }
})


fastify.listen(
  {
    port: process.env.PORT || 3000,
    host: process.env.RENDER_EXTERNAL_URL ? '0.0.0.0' : process.env.HOST || 'localhost',
  },
  function (err) {
    if (err) {
      fastify.log.error(err)
      process.exit(1)
    }

    //////////////////////////////////////////////////////////////////////
    // Don't delete this line, it is used to submit your API for review //
    // everytime your start your server.                                //
    //////////////////////////////////////////////////////////////////////
    submitForReview(fastify)
  }
)
