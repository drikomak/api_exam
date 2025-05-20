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
    const city = citiesDatabase[cityId]

    if (!city) {
      return reply.status(404).send({ error: 'City not found' })
    }

    return {
      // Format coordinates as [lat, lon] array
      coordinates: [city.coordinates[0].latitude, city.coordinates[0].longitude],
      // Population as is
      population: city.population,
      // Map knownFor to array of strings (just the content)
      knownFor: city.knownFor.map(item => item.content),
      // Format weather predictions with when, min, max
      weatherPredictions: city.weatherPredictions.map(w => ({
        when: w.date,
        min: w.minTemperature,
        max: w.maxTemperature
      })),
      // Recipes array from storage
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
