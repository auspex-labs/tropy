'use strict'

const React = require('react')
const { PureComponent } = React
const { EsperView } = require('./view')
const { EsperToolbar } = require('./toolbar')
const { get, restrict, shallow } = require('../../common/util')
const { isHorizontal, rotate, round } = require('../../common/math')
const { Rotation } = require('../../common/iiif')
const { assign } = Object
const debounce = require('lodash.debounce')
const throttle = require('lodash.throttle')
const cx = require('classnames')
const { min } = Math

const {
  arrayOf, bool, func, node, number, object, shape, string
} = require('prop-types')

const { TOOL, MODE } = require('../../constants/esper')

const {
  ESPER: {
    MAX_ZOOM,
    MIN_ZOOM,
    ROTATE_DURATION,
    ZOOM_DURATION,
    ZOOM_STEP_SIZE,
    ZOOM_WHEEL_FACTOR,
    ZOOM_PRECISION
  }
} = require('../../constants/sass')


class Esper extends PureComponent {
  constructor(props) {
    super(props)
    this.state = this.getEmptyState(props)
  }

  componentDidMount() {
    this.ro = new ResizeObserver(([e]) => {
      this.resize(e.contentRect)
    })
    this.ro.observe(this.view.container)
  }

  componentWillUnmount() {
    this.ro.disconnect()
    this.persist.flush()
  }

  componentWillReceiveProps(props) {
    if (!shallow(props, this.props)) {
      const state = this.getStateFromProps(props)

      switch (true) {
        case (this.shouldViewReset(props, state)):
          this.view.reset(state)
          break
        case (this.shouldViewSync(props, state)):
          this.view.sync(state)
          break
      }

      if (this.shouldToolReset(props)) {
        state.tool = Esper.defaultProps.tool
        this.handleToolChange(state.tool)
      }

      this.setState(state)
    }
  }

  shouldViewReset(props, state) {
    if (state.src !== this.state.src) return true
    if (get(props.photo, ['id']) !== get(this.props.photo, ['id'])) return true
    return false
  }

  shouldViewSync(props) {
    if (props.selection !== this.props.selection) return true
    if (props.selections !== this.props.selections) return true
    if (props.tool !== this.props.tool) return true
    return false
  }

  shouldToolReset(props) {
    if (props.selection == null) return false
    if (props.tool !== TOOL.SELECT) return false
    return true
  }

  get isEmpty() {
    return this.props.photo == null || this.props.photo.pending === true
  }

  get isDisabled() {
    return this.props.isDisabled || this.isEmpty
  }

  getActiveImageId() {
    return get(this.props.selection, ['id']) || get(this.props.photo, ['id'])
  }

  getEmptyState(props = this.props) {
    return {
      mode: props.mode,
      zoom: props.zoom,
      minZoom: props.minZoom,
      angle: 0,
      mirror: false,
      width: 0,
      height: 0,
      aspect: 0,
      src: null,
      x: props.x,
      y: props.y,
      tool: props.tool
    }
  }

  getStateFromProps(props) {
    const state = this.getEmptyState(props)
    const { photo } = props
    const screen = this.view.bounds

    if (photo != null && !photo.pending) {
      state.src = `${photo.protocol}://${photo.path}`

      assign(state, this.getOrientationState(photo))
      assign(state, this.getAngleBounds({
        angle: state.angle,
        width: photo.width,
        height: photo.height
      }))
    }

    if (state.x == null || state.mode !== 'zoom') {
      state.x = screen.width / 2
    }

    if (state.y == null || state.mode === 'fit') {
      state.y = screen.height / 2
    }

    assign(state, this.getZoomBounds(screen, state, props))

    return state
  }


  getZoomToFill(screen, { width } = this.state, props = this.props) {
    return round(min(props.maxZoom, screen.width / width), ZOOM_PRECISION)
  }

  getZoomToFit(
    screen,
    { width, height } = this.state,
    { minZoom } = this.props
  ) {
    return round(
      min(minZoom, min(screen.width / width, screen.height / height)
    ), ZOOM_PRECISION)
  }

  getZoomBounds(
    screen = this.view.bounds,
    state = this.state,
    props = this.props
  ) {
    let { zoom, width, height } = state
    let { minZoom } = props
    let zoomToFill = minZoom

    if (width > 0 && height > 0) {
      minZoom = this.getZoomToFit(screen, state, props)
      zoomToFill = this.getZoomToFill(screen, state, props)

      switch (state.mode) {
        case 'fill':
          zoom = zoomToFill
          break
        case 'fit':
          zoom = minZoom
          break
      }

      if (minZoom > zoom) zoom = minZoom
    }

    return { minZoom, zoom, zoomToFill }
  }

  getAngleBounds({ angle, width, height }) {
    if (width === 0 || height === 0) {
      return {
        width: 0, height: 0, aspect: 0
      }
    }

    if (isHorizontal(angle)) {
      return {
        width, height, aspect: width / height
      }
    }

    return {
      width: height, height: width, aspect: height / width
    }
  }

  getImageState() {
    const { mode, x, y, zoom } = this.state
    const id = this.getActiveImageId()

    return id == null ? null : {
      [id]: {
        mode,
        x: round(x),
        y: round(y),
        zoom
      }
    }
  }

  getPhotoState() {
    const id = get(this.props.photo, ['id'])
    const { angle, mirror } = this.getRelativeRotation()

    return id == null ? null : {
      id, data: { angle, mirror }
    }
  }

  getOrientationState({ angle, mirror, orientation }) {
    return Rotation
      .fromExifOrientation(orientation)
      .add({ angle, mirror })
      .toJSON()
  }

  getRelativeRotation(
    { angle, mirror } = this.state,
    orientation = this.props.photo.orientation
  ) {
    return new Rotation({ angle, mirror })
      .subtract(Rotation.fromExifOrientation(orientation))
  }

  setView = (view) => {
    this.view = view
  }

  resize = throttle(({ width, height }) => {
    width = round(width || this.view.bounds.width)
    height = round(height || this.view.bounds.height)

    const { minZoom, zoom, zoomToFill } = this.getZoomBounds({ width, height })

    this.view.resize({
      width, height, zoom, mirror: this.state.mirror
    })

    this.setState({ minZoom, zoom, zoomToFill })
  }, 50)

  persist = debounce(() => {
    this.props.onChange({
      image: this.getImageState(),
      photo: this.getPhotoState()
    })
  }, 650)

  update = debounce(() => {
    this.props.onChange({ image: this.getImageState() })
  }, 650)

  handleRotationChange = (by) => {
    const state = {
      ...this.state,
      angle: rotate(this.state.angle, by),
      width: this.props.photo.width,
      height: this.props.photo.height
    }

    assign(state, this.getAngleBounds(state))
    assign(state, this.getZoomBounds(this.view.bounds, state))

    this.setState(state)

    this.view.rotate(state, ROTATE_DURATION)
    this.view.scale(state, ROTATE_DURATION)

    this.persist()
  }

  handleZoomChange = ({ x, y, zoom }, animate) => {
    zoom = restrict(zoom, this.state.minZoom, this.props.maxZoom)

    this.setState({ zoom, mode: 'zoom' })
    this.view.scale({
      zoom, mirror: this.state.mirror
    }, animate ? ZOOM_DURATION : 0, { x, y })
  }

  handleMirrorChange = () => {
    let { angle, zoom, mirror } = this.state

    mirror = !mirror

    if (!isHorizontal(angle)) angle = rotate(angle, 180)

    this.setState({ angle, mirror })

    this.view.scale({ zoom, mirror })
    this.view.rotate({ angle })

    this.persist()
  }

  handleModeChange = (mode) => {
    let { minZoom, mirror, zoom, zoomToFill  } = this.state

    switch (mode) {
      case 'fill':
        zoom = zoomToFill
        break
      case 'fit':
        zoom = minZoom
        break
    }

    this.setState({ zoom, mode })
    this.view.scale({ zoom, mirror }, ZOOM_DURATION)
  }

  handleToolChange = (tool) => {
    this.props.onChange({ esper: { tool } })
  }

  handleWheel = ({ x, y, dy, dx, ctrl }) => {
    if (ctrl) {
      this.handleZoomChange({
        x, y, zoom: this.state.zoom + dy * ZOOM_WHEEL_FACTOR
      })
    } else {
      const mw = this.props.invertMouseWheel ? -1 : 1

      this.view.move({
        x: this.view.image.x + (dx * mw),
        y: this.view.image.y + (dy * mw)
      })
    }
  }

  handleDoubleClick = ({ x, y, shift }) => {
    const step = shift ?
      -ZOOM_STEP_SIZE : ZOOM_STEP_SIZE

    this.handleZoomChange({
      x, y, zoom: this.state.zoom + step
    }, ZOOM_DURATION)
  }

  handleSelectionActivate = (selection) => {
    const { photo } = this.props
    this.props.onSelect({
      photo: photo.id,
      item: photo.item,
      selection: selection.id,
      note: selection.notes[0]
    })
  }

  handleSelectionCreate = (selection) => {
    const { angle, mirror } = this.state

    this.props.onSelectionCreate({
      photo: this.props.photo.id,
      angle,
      mirror,
      ...selection
    })
  }

  handleViewChange = (state) => {
    state.zoom = round(state.zoom, ZOOM_PRECISION)
    this.setState(state, this.update)
  }

  render() {
    const { isDisabled } = this

    return (
      <section className={cx(['esper', this.props.tool])}>
        <EsperHeader>
          <EsperToolbar
            isDisabled={isDisabled}
            mode={this.state.mode}
            tool={this.props.tool}
            zoom={this.state.zoom}
            minZoom={this.state.minZoom}
            maxZoom={this.props.maxZoom}
            onMirrorChange={this.handleMirrorChange}
            onModeChange={this.handleModeChange}
            onToolChange={this.handleToolChange}
            onRotationChange={this.handleRotationChange}
            onZoomChange={this.handleZoomChange}/>
        </EsperHeader>
        <EsperView
          ref={this.setView}
          selection={this.props.selection}
          selections={this.props.selections}
          tool={this.props.tool}
          onChange={this.handleViewChange}
          onSelectionActivate={this.handleSelectionActivate}
          onSelectionCreate={this.handleSelectionCreate}
          onDoubleClick={this.handleDoubleClick}
          onWheel={this.handleWheel}/>
      </section>
    )
  }

  static propTypes = {
    isDisabled: bool,
    invertMouseWheel: bool.isRequired,
    maxZoom: number.isRequired,
    minZoom: number.isRequired,
    mode: string.isRequired,
    onChange: func.isRequired,
    onSelect: func.isRequired,
    onSelectionCreate: func.isRequired,
    photo: object,
    tool: string.isRequired,
    selection: object,
    selections: arrayOf(shape({
      id: number.isRequired,
      height: number.isRequired,
      width: number.isRequired,
      x: number.isRequired,
      y: number.isRequired
    })).isRequired,
    x: number,
    y: number,
    zoom: number.isRequired
  }

  static defaultProps = {
    invertMouseWheel: true,
    maxZoom: MAX_ZOOM,
    minZoom: MIN_ZOOM,
    mode: MODE.FIT,
    tool: TOOL.ARROW,
    zoom: 1
  }
}


const EsperHeader = ({ children }) => (
  <header className="esper-header draggable">{children}</header>
)

EsperHeader.propTypes = {
  children: node
}


module.exports = {
  EsperHeader,
  Esper
}
