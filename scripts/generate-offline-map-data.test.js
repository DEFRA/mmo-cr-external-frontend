import {
  coordinate,
  overlapsSea,
  pointInPolygon
} from './generate-offline-map-data.js'
import {
  closestSubrectangles
} from '../src/client/javascripts/modules/statistical-area-map.js'

const square = (minimumLongitude, minimumLatitude, maximumLongitude, maximumLatitude) => ({
  exterior: [[minimumLongitude, minimumLatitude], [maximumLongitude, minimumLatitude], [maximumLongitude, maximumLatitude], [minimumLongitude, maximumLatitude]],
  holes: []
})

describe('offline map preprocessing', () => {
  test('Should accept numeric strings and recover Web Mercator coordinates', () => {
    expect(coordinate(['-2.6', '50.667'])).toEqual([-2.6, 50.667])
    const [longitude, latitude] = coordinate([-1264519.1036012699, 6303188.702299997])
    expect(longitude).toBeCloseTo(-11.36, 2)
    expect(latitude).toBeCloseTo(49.1667, 3)
  })

  test('Should respect polygon holes and identify a fully inland rectangle', () => {
    const land = square(-1, -1, 2, 2)
    land.bounds = { minLongitude: -1, maxLongitude: 2, minLatitude: -1, maxLatitude: 2 }
    expect(pointInPolygon([0.5, 0.5], land)).toBe(true)
    expect(overlapsSea([square(0, 0, 1, 1)], [land])).toBe(false)
  })

  test('Should return all nearest rectangles for a departure port', () => {
    const subrectangles = [
      { subCode: 'FAR', overlapsSea: true, labelCoordinate: [2, 2] },
      { subCode: 'LAND', overlapsSea: false, labelCoordinate: [0, 0] },
      { subCode: 'NEAR', overlapsSea: true, labelCoordinate: [0.1, 0.1] }
    ]

    expect(
      closestSubrectangles(subrectangles, [0, 0], 9).map(
        (subrectangle) => subrectangle.subCode
      )
    ).toEqual(['LAND', 'NEAR', 'FAR'])
  })

})