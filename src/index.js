import 'dotenv/config'
import Fastify from 'fastify'
import { submitForReview } from './submission.js'

const fastify = Fastify({
  logger: true,
})

const recipeStorage = {} // stockage en mémoire des recettes
const allowedCities = ['paris', 'lyon', 'marseille'] // mock des villes existantes

function generateId() {
  return Math.floor(Math.random() * 1000000)
}

fastify.get('/cities/:cityId/infos', async (request, reply) => {
  const { cityId } = request.params

  if (!allowedCities.includes(cityId)) {
    return reply.status(404).send({ error: 'City not found' })
  }

  reply.send({
    coordinates: [48.8566, 2.3522],
    population: 2148000,
    knownFor: ['gastronomy', 'architecture'],
    weatherPredictions: [
      { when: 'today', min: 10, max: 20 },
      { when: 'tomorrow', min: 12, max: 22 }
    ],
    recipes: recipeStorage[cityId] || []
  })
})

fastify.post('/cities/:cityId/recipes', async (request, reply) => {
  const { cityId } = request.params
  const { content } = request.body

  if (!allowedCities.includes(cityId)) {
    return reply.status(404).send({ error: 'City not found' })
  }

  if (!content || typeof content !== 'string' || content.length < 10 || content.length > 2000) {
    return reply.status(400).send({ error: 'Invalid content length' })
  }

  const newRecipe = { id: generateId(), content }
  if (!recipeStorage[cityId]) recipeStorage[cityId] = []
  recipeStorage[cityId].push(newRecipe)

  reply.status(201).send(newRecipe)
})

fastify.delete('/cities/:cityId/recipes/:recipeId', async (request, reply) => {
  const { cityId, recipeId } = request.params

  if (!allowedCities.includes(cityId)) {
    return reply.status(404).send({ error: 'City not found' })
  }

  const recipes = recipeStorage[cityId]
  if (!recipes) return reply.status(404).send({ error: 'Recipe not found' })

  const index = recipes.findIndex(r => r.id == recipeId)
  if (index === -1) return reply.status(404).send({ error: 'Recipe not found' })

  recipes.splice(index, 1)
  reply.status(204).send()
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
