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
  containsPoint,
  screenRectanglesOverlap
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

function areaLabelBounds(textX, textY, textWidth, fontSize) {
  const top =
    textY - fontSize + selectedLabelTopOffset - selectedLabelVerticalPadding
  return {
    left: textX - selectedLabelHorizontalPadding,
    right: textX + textWidth + selectedLabelHorizontalPadding,
    top,
    bottom: top + fontSize + selectedLabelVerticalPadding * 2
  }
}

function areaLabelPosition(x, y, textWidth, fontSize, cellBounds, avoidBounds) {
  const clearOffset = labelPadding * 3
  const candidates = [
    [x + labelPadding, y - labelPadding],
    [x + labelPadding, y + fontSize + clearOffset],
    [x - textWidth - clearOffset, y - labelPadding],
    [x - textWidth - clearOffset, y + fontSize + clearOffset]
  ].map(([textX, textY]) => ({
    textX,
    textY,
    bounds: areaLabelBounds(textX, textY, textWidth, fontSize)
  }))
  const fitsCell = ({ bounds }) =>
    bounds.left >= cellBounds.left &&
    bounds.right <= cellBounds.right &&
    bounds.top >= cellBounds.top &&
    bounds.bottom <= cellBounds.bottom
  const isClear = ({ bounds }) =>
    !avoidBounds.some((other) => screenRectanglesOverlap(bounds, other))
  return (
    candidates.find((candidate) => fitsCell(candidate) && isClear(candidate)) ||
    candidates[0]
  )
}

function drawSubrectangleLabel(
  context,
  area,
  land,
  viewport,
  canvas,
  selectedCode,
  fontSize,
  avoidBounds
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
    return undefined
  }

  const labelCoordinate = clampPointToBounds(area.labelCoordinate, visible)
  const [x, y] = toScreen(labelCoordinate, viewport, canvas)
  const isSelected = area.subCode === selectedCode?.toUpperCase()
  const textWidth = context.measureText(area.subCode).width
  const { textX, textY, bounds } = areaLabelPosition(
    x,
    y,
    textWidth,
    fontSize,
    { left: leftX, right: rightX, top: topY, bottom: bottomY },
    avoidBounds
  )
  if (isSelected) {
    drawSelectedLabel(context, area.subCode, textX, textY, fontSize)
  } else {
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
  return bounds
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
  selectedCode,
  avoidBounds
) {
  const fontSize = Math.max(
    minimumLabelFontSize,
    canvas.width / fontSizeCanvasWidthDivisor
  )
  context.font = `${fontSize}px sans-serif`
  return subrectangles
    .filter((area) => boundsIntersect(area.bounds, viewport))
    .map((area) =>
      drawSubrectangleLabel(
        context,
        area,
        land,
        viewport,
        canvas,
        selectedCode,
        fontSize,
        avoidBounds
      )
    )
    .filter(Boolean)
}

// Returns the screen bounds of the drawn area labels so port labels can avoid them.
export function drawMapLayers(
  context,
  { subrectangles, land, viewport, canvas, selectedCode, avoidBounds = [] }
) {
  drawSubrectangles(context, subrectangles, viewport, canvas, selectedCode)
  drawLand(context, land, viewport, canvas)
  return drawSubrectangleLabels(
    context,
    subrectangles,
    land,
    viewport,
    canvas,
    selectedCode,
    avoidBounds
  )
}
