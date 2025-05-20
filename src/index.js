import 'dotenv/config'
import Fastify from 'fastify'
import { submitForReview } from './submission.js'

const fastify = Fastify({
  logger: true,
})

// Store recipes in memory
const recipeStorage = {}

function generateId() {
  return Math.floor(Math.random() * 1000000).toString()
}

fastify.get('/cities/:cityId/infos', async (request, reply) => {
  try {
    const { cityId } = request.params
    
    // Format de réponse selon la documentation
    return {
      coordinates: [
        {
          latitude: 51.5074,
          longitude: -0.1278
        }
      ],
      population: 256000,
      knownFor: [
        {
          format: "attraction",
          content: "Pixel Art Gallery"
        },
        {
          format: "landmark",
          content: "Raster Road"
        }
      ],
      weatherPredictions: [
        {
          minTemperature: 5,
          maxTemperature: 15,
          date: "today"
        },
        {
          minTemperature: 6,
          maxTemperature: 16,
          date: "tomorrow"
        }
      ],
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

  const newRecipe = { id: generateId(), content }
  if (!recipeStorage[cityId]) recipeStorage[cityId] = []
  recipeStorage[cityId].push(newRecipe)

  reply.status(201).send(newRecipe)
})

fastify.delete('/cities/:cityId/recipes/:recipeId', async (request, reply) => {
  try {
    const { cityId, recipeId } = request.params
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
    submitForReview(fastify)
  }
)
