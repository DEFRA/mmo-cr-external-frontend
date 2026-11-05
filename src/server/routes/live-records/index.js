import Joi from 'joi'
import Boom from '@hapi/boom'
import { liveCatchRecords } from '#/server/common/helpers/journey/catch-record-service.js'
import { recordAction, showHistory, downloadArtifact } from './controller.js'

const recordId = Joi.string().trim().min(1).max(200).required()
const params = Joi.object({ recordId })
export const liveRecords = {
  name: 'live-records',
  register(server) {
    server.route(
      [
        {
          method: 'POST',
          path: '/records/{recordId}/{action}',
          options: {
            validate: {
              params: params.keys({
                action: Joi.string()
                  .valid('resume', 'delete', 'edit', 'complete')
                  .required()
              }),
              payload: Joi.object({ actionKey: Joi.string().uuid().required() })
            }
          },
          handler: recordAction
        },
        {
          method: 'GET',
          path: '/records/{recordId}/history',
          options: { validate: { params } },
          handler: showHistory
        },
        {
          method: 'GET',
          path: '/records/{recordId}/submissions/{submissionNumber}/{artifactType}',
          options: {
            validate: {
              params: params.keys({
                submissionNumber: Joi.number()
                  .integer()
                  .min(1)
                  .max(1000)
                  .required(),
                artifactType: Joi.string().valid('json', 'pdf').required()
              })
            }
          },
          handler: downloadArtifact
        }
      ].map((route) => ({
        ...route,
        handler: (request, h) => {
          if (!liveCatchRecords()) throw Boom.notFound()
          return route.handler(request, h)
        }
      }))
    )
  }
}
