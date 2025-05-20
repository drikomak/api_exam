import 'dotenv/config'
import Fastify from 'fastify'
import { submitForReview } from './submission.js'

const fastify = Fastify({
  logger: true,
})

// Pre-populated database of cities
const citiesDatabase = {
  'pixelton': {
    id: 'pixelton',
    name: 'Pixelton',
    coordinates: [{
      latitude: 51.5074,
      longitude: -0.1278
    }],
    population: 256000,
    country: 'Graphica',
    knownFor: [
      {
        format: 'attraction',
        content: 'Pixel Art Gallery'
      },
      {
        format: 'landmark',
        content: 'Raster Road'
      }
    ],
    weatherPredictions: [
      {
        minTemperature: 5,
        maxTemperature: 15,
        date: 'today'
      },
      {
        minTemperature: 6,
        maxTemperature: 16,
        date: 'tomorrow'
      }
    ],
    recipes: [
      {
        id: 'pixel-pancakes',
        content: 'Mix 1 cup flour, 1 tbsp sugar, 1 tsp baking powder, and 1/2 tsp salt. Add 1 egg, 1 cup milk, and 2 tbsp melted butter. Cook on a griddle, flipping when pixels form. Stack and serve with syrup!'
      },
      {
        id: 'raster-ravioli',
        content: 'Mix 2 cups flour, 3 eggs, and a pinch of salt. Roll into sheets, fill with ricotta and spinach. Cut into squares, boil until al dente. Serve with pixelated pesto sauce.'
      }
    ]
  }
}

// Store recipes separately but initialize with the ones from citiesDatabase
const recipeStorage = Object.entries(citiesDatabase).reduce((acc, [cityId, city]) => {
  acc[cityId] = [...city.recipes]
  return acc
}, {})

function generateId() {
  return Math.floor(Math.random() * 1000000).toString()
}

fastify.get('/cities/:cityId/infos', async (request, reply) => {
  try {
    const { cityId } = request.params
    const apiKey = process.env.API_KEY
    const baseUrl = 'https://api-ugi2pflmha-ew.a.run.app'

    // Fetch city data
    const cityRes = await fetch(`${baseUrl}/cities/${cityId}/insights?apiKey=${apiKey}`)
    if (!cityRes.ok) {
      return reply.status(404).send({ error: 'City not found' })
    }
    const city = await cityRes.json()

    // Fetch weather data
    const weatherRes = await fetch(`${baseUrl}/weather-predictions?cityIdentifier=${cityId}&apiKey=${apiKey}`)
    if (!weatherRes.ok) {
      return reply.status(500).send({ error: 'Weather API error' })
    }
    const weatherData = await weatherRes.json()

    // Format the response
    return {
      coordinates: [{
        latitude: city.coordinates[0].latitude,
        longitude: city.coordinates[0].longitude
      }],
      population: city.population,
      knownFor: Array.isArray(city.knownFor) ? city.knownFor : [],
      weatherPredictions: weatherData[0]?.predictions?.slice(0, 2).map((w, i) => ({
        minTemperature: w.minTemperature,
        maxTemperature: w.maxTemperature,
        date: i === 0 ? 'today' : 'tomorrow'
      })) || [],
      recipes: recipeStorage[cityId] || []
    }
  } catch (error) {
    fastify.log.error(error)
    return reply.status(500).send({ error: 'Internal server error' })
  }
})

fastify.post('/cities/:cityId/recipes', async (request, reply) => {
  const { cityId } = request.params
  const { content } = request.body

  if (!content || typeof content !== 'string') {
    return reply.status(400).send({ error: 'Content is required and must be a string' })
  }

  if (content.length < 10 || content.length > 2000) {
    return reply.status(400).send({ error: 'Content length must be between 10 and 2000 characters' })
  }

  if (!citiesDatabase[cityId]) {
    return reply.status(404).send({ error: 'City not found' })
  }

  const newRecipe = { id: generateId(), content }
  if (!recipeStorage[cityId]) recipeStorage[cityId] = []
  recipeStorage[cityId].push(newRecipe)

  reply.status(201).send(newRecipe)
})

fastify.delete('/cities/:cityId/recipes/:recipeId', async (request, reply) => {
  try {
    const { cityId, recipeId } = request.params

    if (!citiesDatabase[cityId]) {
      return reply.status(404).send({ error: 'City not found' })
    }

    const recipes = recipeStorage[cityId]
    if (!recipes) {
      return reply.status(404).send({ error: 'Recipe not found' })
    }

    const index = recipes.findIndex(r => r.id === recipeId)
    if (index === -1) {
      return reply.status(404).send({ error: 'Recipe not found' })
    }

    recipes.splice(index, 1)
    return reply.status(204).send()
  } catch (error) {
    fastify.log.error(error)
    return reply.status(500).send({ error: 'Internal server error' })
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
