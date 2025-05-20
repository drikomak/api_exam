import 'dotenv/config'
import Fastify from 'fastify'
import { submitForReview } from './submission.js'

const fastify = Fastify({
  logger: true,
})

const recipeStorage = {} // stockage en mémoire des recettes

function generateId() {
  return Math.floor(Math.random() * 1000000)
}

fastify.get('/cities/:cityId/infos', async (request, reply) => {
  // Placeholder (à remplacer avec axios + API externe)
  reply.send({
    coordinates: [0, 0],
    population: 100000,
    knownFor: ['example'],
    weatherPredictions: [
      { when: 'today', min: 10, max: 20 },
      { when: 'tomorrow', min: 11, max: 21 }
    ],
    recipes: recipeStorage[request.params.cityId] || []
  })
})

fastify.post('/cities/:cityId/recipes', async (request, reply) => {
  const { cityId } = request.params
  const { content } = request.body

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
