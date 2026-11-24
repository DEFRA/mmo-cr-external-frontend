import {
  minimumLabelFontSize,
  fontSizeCanvasWidthDivisor,
  portMarkerRadius
} from './statistical-area-map-constants.js'
import {
  containsPoint,
  screenRectanglesOverlap,
  toCoordinate,
  toScreen
} from './statistical-area-map-geometry.js'

const duplicateCoordinatePrecision = 5
const coordinateMatchTolerance = 1e-6
const labelEdgePadding = 2
const labelGap = 2
const labelHorizontalPadding = 4
const labelVerticalPadding = 2
const waterLabelFill = 'rgba(255, 255, 255, 0.94)'
const landLabelFill = 'rgba(11, 65, 67, 0.96)'
const landLabelStroke = '#0B4143'
const waterLabelStroke = 'rgba(11, 65, 67, 0.45)'
const darkLabelText = '#0B1F22'
const lightLabelText = '#FFFFFF'
const markerFill = '#01FEE2'
const markerStroke = '#000000'
const portLabelFontSizeOffset = 20

function portHasCoordinate(port) {
  return (
    Array.isArray(port.coordinate) &&
    port.coordinate.length >= 2 &&
    Number.isFinite(port.coordinate[0]) &&
    Number.isFinite(port.coordinate[1])
  )
}

function isCoordinateInViewport(coordinate, viewport) {
  return (
    coordinate[0] >= viewport.minLongitude &&
    coordinate[0] <= viewport.maxLongitude &&
    coordinate[1] >= viewport.minLatitude &&
    coordinate[1] <= viewport.maxLatitude
  )
}

function visiblePorts(ports, viewport) {
  return ports.filter(
    (port) =>
      portHasCoordinate(port) &&
      isCoordinateInViewport(port.coordinate, viewport)
  )
}

function isDeparturePort(port, departurePort) {
  return (
    port.name?.toLowerCase() === departurePort.name?.toLowerCase() ||
    (Math.abs(port.coordinate[0] - departurePort.coordinate[0]) <
      coordinateMatchTolerance &&
      Math.abs(port.coordinate[1] - departurePort.coordinate[1]) <
        coordinateMatchTolerance)
  )
}

function coordinateKey(coordinate) {
  return coordinate
    .map((value) => value.toFixed(duplicateCoordinatePrecision))
    .join(',')
}

function portMarkerBounds([portX, portY]) {
  return {
    left: portX - portMarkerRadius - labelEdgePadding,
    right: portX + portMarkerRadius + labelEdgePadding,
    top: portY - portMarkerRadius - labelEdgePadding,
    bottom: portY + portMarkerRadius + labelEdgePadding
  }
}

function markerPositions(ports, departurePort, viewport, canvas) {
  const seenCoordinates = new Set()
  const positions = []
  let departureVisible = false

  for (const port of ports) {
    const key = coordinateKey(port.coordinate)
    if (!seenCoordinates.has(key)) {
      seenCoordinates.add(key)
      positions.push(toScreen(port.coordinate, viewport, canvas))
      departureVisible ||= isDeparturePort(port, departurePort)
    }
  }

  if (!departureVisible) {
    positions.push(toScreen(departurePort.coordinate, viewport, canvas))
  }
  return positions
}

export function portMarkerScreenBounds(ports, departurePort, viewport, canvas) {
  return markerPositions(
    visiblePorts(ports, viewport),
    departurePort,
    viewport,
    canvas
  ).map(portMarkerBounds)
}

function drawPortMarkers(context, ports, departurePort, viewport, canvas) {
  const positions = markerPositions(ports, departurePort, viewport, canvas)
  for (const [x, y] of positions) {
    context.fillStyle = markerFill
    context.strokeStyle = markerStroke
    context.lineWidth = 1
    context.beginPath()
    context.arc(x, y, portMarkerRadius, 0, Math.PI * 2)
    context.fill()
    context.stroke()
  }
  return positions.map(portMarkerBounds)
}

function labelCandidates(portX, portY, labelWidth, labelHeight) {
  const markerOffset = portMarkerRadius + labelGap + labelEdgePadding
  const rightLeft = portX + markerOffset
  const leftLeft = portX - markerOffset - labelWidth
  const centredLeft = portX - labelWidth / 2
  const middleTop = portY - labelHeight / 2
  const aboveTop = portY - markerOffset - labelHeight
  const belowTop = portY + markerOffset
  return [
    { left: rightLeft, top: middleTop },
    { left: leftLeft, top: middleTop },
    { left: centredLeft, top: aboveTop },
    { left: centredLeft, top: belowTop },
    { left: rightLeft, top: aboveTop },
    { left: rightLeft, top: belowTop },
    { left: leftLeft, top: aboveTop },
    { left: leftLeft, top: belowTop }
  ]
}

function labelFits(bounds, occupiedBounds, canvas) {
  return (
    bounds.left >= labelEdgePadding &&
    bounds.top >= labelEdgePadding &&
    bounds.right <= canvas.width - labelEdgePadding &&
    bounds.bottom <= canvas.height - labelEdgePadding &&
    !occupiedBounds.some((existing) =>
      screenRectanglesOverlap(bounds, existing, labelGap)
    )
  )
}

function candidateBounds(candidate, width, height) {
  return {
    ...candidate,
    right: candidate.left + width,
    bottom: candidate.top + height
  }
}

function labelIsOnLand(land, coordinate) {
  return land.some(
    (feature) =>
      isCoordinateInViewport(coordinate, feature.bounds) &&
      containsPoint(coordinate, feature)
  )
}

function portLabelStyle(context, land, bounds, viewport, canvas) {
  const centerCoordinate = toCoordinate(
    [(bounds.left + bounds.right) / 2, (bounds.top + bounds.bottom) / 2],
    viewport,
    canvas
  )
  const isOnLand = labelIsOnLand(land, centerCoordinate)
  context.fillStyle = isOnLand ? landLabelFill : waterLabelFill
  context.strokeStyle = isOnLand ? landLabelStroke : waterLabelStroke
  return isOnLand ? lightLabelText : darkLabelText
}

function sortPortsByPriority(ports, departurePort) {
  const distanceFromDeparture = (port) =>
    (port.coordinate[0] - departurePort.coordinate[0]) ** 2 +
    (port.coordinate[1] - departurePort.coordinate[1]) ** 2
  return ports.toSorted((first, second) => {
    const firstIsDeparture = isDeparturePort(first, departurePort)
    const secondIsDeparture = isDeparturePort(second, departurePort)
    if (firstIsDeparture !== secondIsDeparture) {
      return firstIsDeparture ? -1 : 1
    }
    return distanceFromDeparture(first) - distanceFromDeparture(second)
  })
}

function drawPortLabel(
  context,
  port,
  land,
  viewport,
  canvas,
  fontSize,
  occupiedBounds
) {
  const [portX, portY] = toScreen(port.coordinate, viewport, canvas)
  const textWidth = Math.min(
    context.measureText(port.name).width,
    canvas.width - labelHorizontalPadding * 2 - labelEdgePadding * 2
  )
  const labelWidth = textWidth + labelHorizontalPadding * 2
  const labelHeight = fontSize + labelVerticalPadding * 2
  const candidates = labelCandidates(portX, portY, labelWidth, labelHeight)
  const label = candidates
    .map((candidate) => candidateBounds(candidate, labelWidth, labelHeight))
    .find((bounds) => labelFits(bounds, occupiedBounds, canvas))

  if (!label) {
    return false
  }

  const textColor = portLabelStyle(context, land, label, viewport, canvas)
  context.lineWidth = 1
  context.fillRect(label.left, label.top, labelWidth, labelHeight)
  context.strokeRect(label.left, label.top, labelWidth, labelHeight)
  context.fillStyle = textColor
  context.fillText(
    port.name,
    label.left + labelHorizontalPadding,
    label.top + labelVerticalPadding + fontSize,
    textWidth
  )
  occupiedBounds.push(label)
  return true
}

function drawPortLabels(
  context,
  ports,
  land,
  departurePort,
  viewport,
  canvas,
  reservedBounds
) {
  const fontSize = Math.max(
    minimumLabelFontSize,
    canvas.width / (fontSizeCanvasWidthDivisor + portLabelFontSizeOffset)
  )
  context.font = `${fontSize}px sans-serif`
  const occupiedBounds = [
    ...drawPortMarkers(context, ports, departurePort, viewport, canvas),
    ...reservedBounds
  ]
  const labelledNames = new Set()
  const sortedPorts = sortPortsByPriority(ports, departurePort)

  sortedPorts.forEach((port) => {
    const normalizedName = port.name?.trim().toLocaleLowerCase()
    if (!normalizedName || labelledNames.has(normalizedName)) {
      return
    }
    if (
      drawPortLabel(
        context,
        port,
        land,
        viewport,
        canvas,
        fontSize,
        occupiedBounds
      )
    ) {
      labelledNames.add(normalizedName)
    }
  })
}

export function drawPorts(
  context,
  ports,
  land,
  departurePort,
  viewport,
  canvas,
  reservedBounds = []
) {
  const inViewport = visiblePorts(ports, viewport)
  drawPortLabels(
    context,
    inViewport,
    land,
    departurePort,
    viewport,
    canvas,
    reservedBounds
  )
}
