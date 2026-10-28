import {
  selectedGridLineWidth,
  minimumLabelFontSize,
  fontSizeCanvasWidthDivisor,
  minimumLabelSpan
} from './statistical-area-map-constants.js'
import {
  boundsIntersect,
  intersectBounds,
  clampPointToBounds,
  toScreen,
  toCoordinate,
  containsPoint
} from './statistical-area-map-geometry.js'

const labelCoverageColumns = 6
const labelCoverageRows = 3
const labelSampleOffset = 0.5
const whiteTextLandCoverageThreshold = 0.5
const labelPadding = 4
const selectedLabelHorizontalPadding = 5
const selectedLabelVerticalPadding = 3
const selectedLabelTopOffset = 2
const selectedLabelFill = '#1D70B8'
const selectedLabelText = '#FFFFFF'
const landLabelText = '#FFFFFF'
const waterLabelText = '#1d1d1d'
const selectedCellFill = 'rgba(29, 112, 184, 0.25)'
const defaultCellFill = 'rgba(11, 107, 58, 0.06)'
const gridStroke = '#0B6B3A'
const landFill = '#0B4143'
const landStroke = '#000000'

function drawPolygon(context, polygon, viewport, canvas) {
  context.beginPath()
  for (const ring of [polygon.exterior, ...polygon.holes]) {
    ring.forEach((coordinate, index) => {
      const [x, y] = toScreen(coordinate, viewport, canvas)
      if (index === 0) {
        context.moveTo(x, y)
      } else {
        context.lineTo(x, y)
      }
    })
    context.closePath()
  }
  context.fill('evenodd')
  context.stroke()
}

function drawSubrectangles(
  context,
  subrectangles,
  viewport,
  canvas,
  selectedCode
) {
  for (const area of subrectangles.filter((feature) =>
    boundsIntersect(feature.bounds, viewport)
  )) {
    const isSelected = area.subCode === selectedCode?.toUpperCase()
    context.fillStyle = isSelected ? selectedCellFill : defaultCellFill
    context.strokeStyle = gridStroke
    context.lineWidth = isSelected ? selectedGridLineWidth : 1
    area.polygons.forEach((polygon) =>
      drawPolygon(context, polygon, viewport, canvas)
    )
  }
}

function drawLand(context, land, viewport, canvas) {
  for (const feature of land.filter((item) =>
    boundsIntersect(item.bounds, viewport)
  )) {
    context.fillStyle = landFill
    context.strokeStyle = landStroke
    context.lineWidth = 1
    feature.polygons.forEach((polygon) =>
      drawPolygon(context, polygon, viewport, canvas)
    )
  }
}

function landCoverageForLabel(land, bounds, viewport, canvas) {
  let landSamples = 0
  for (let column = 0; column < labelCoverageColumns; column += 1) {
    for (let row = 0; row < labelCoverageRows; row += 1) {
      const coordinate = toCoordinate(
        [
          bounds.left +
            ((column + labelSampleOffset) / labelCoverageColumns) *
              (bounds.right - bounds.left),
          bounds.top +
            ((row + labelSampleOffset) / labelCoverageRows) *
              (bounds.bottom - bounds.top)
        ],
        viewport,
        canvas
      )
      if (isLandCoordinate(land, coordinate)) {
        landSamples += 1
      }
    }
  }
  return landSamples / (labelCoverageColumns * labelCoverageRows)
}

function isLandCoordinate(land, coordinate) {
  return land.some(
    (feature) =>
      coordinate[0] >= feature.bounds.minLongitude &&
      coordinate[0] <= feature.bounds.maxLongitude &&
      coordinate[1] >= feature.bounds.minLatitude &&
      coordinate[1] <= feature.bounds.maxLatitude &&
      containsPoint(coordinate, feature)
  )
}

function drawSubrectangleLabel(
  context,
  area,
  land,
  viewport,
  canvas,
  selectedCode,
  fontSize
) {
  const visible = intersectBounds(area.bounds, viewport)
  const [leftX, topY] = toScreen(
    [visible.minLongitude, visible.maxLatitude],
    viewport,
    canvas
  )
  const [rightX, bottomY] = toScreen(
    [visible.maxLongitude, visible.minLatitude],
    viewport,
    canvas
  )
  if (rightX - leftX < minimumLabelSpan || bottomY - topY < minimumLabelSpan) {
    return
  }

  const labelCoordinate = clampPointToBounds(area.labelCoordinate, visible)
  const [x, y] = toScreen(labelCoordinate, viewport, canvas)
  const isSelected = area.subCode === selectedCode?.toUpperCase()
  const textX = x + labelPadding
  const textY = y - labelPadding
  if (isSelected) {
    drawSelectedLabel(context, area.subCode, textX, textY, fontSize)
  } else {
    const textWidth = context.measureText(area.subCode).width
    const landCoverage = landCoverageForLabel(
      land,
      {
        left: textX,
        right: textX + textWidth,
        top: textY - fontSize,
        bottom: textY
      },
      viewport,
      canvas
    )
    context.fillStyle =
      landCoverage > whiteTextLandCoverageThreshold
        ? landLabelText
        : waterLabelText
  }
  context.fillText(area.subCode, textX, textY)
}

function drawSelectedLabel(context, code, textX, textY, fontSize) {
  const textWidth = context.measureText(code).width
  context.fillStyle = selectedLabelFill
  context.fillRect(
    textX - selectedLabelHorizontalPadding,
    textY - fontSize + selectedLabelTopOffset - selectedLabelVerticalPadding,
    textWidth + selectedLabelHorizontalPadding * 2,
    fontSize + selectedLabelVerticalPadding * 2
  )
  context.fillStyle = selectedLabelText
}

function drawSubrectangleLabels(
  context,
  subrectangles,
  land,
  viewport,
  canvas,
  selectedCode
) {
  const fontSize = Math.max(
    minimumLabelFontSize,
    canvas.width / fontSizeCanvasWidthDivisor
  )
  context.font = `${fontSize}px sans-serif`
  subrectangles
    .filter((area) => boundsIntersect(area.bounds, viewport))
    .forEach((area) =>
      drawSubrectangleLabel(
        context,
        area,
        land,
        viewport,
        canvas,
        selectedCode,
        fontSize
      )
    )
}

export function drawMapLayers(
  context,
  { subrectangles, land, viewport, canvas, selectedCode }
) {
  drawSubrectangles(context, subrectangles, viewport, canvas, selectedCode)
  drawLand(context, land, viewport, canvas)
  drawSubrectangleLabels(
    context,
    subrectangles,
    land,
    viewport,
    canvas,
    selectedCode
  )
}
