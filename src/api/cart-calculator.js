import { blinkService } from '../../net/services'
import { getRequestHeader } from '../../utils'

export default async function handler(req, res) {
  await blinkService
    .requestCartCalculator(getRequestHeader(req), req.body)
    .then((response) => {
      res.status(response.status).json(response.data)
    })
    .catch((error) => {
      res.status(error.status).json({ msg: error.message })
    })
}
