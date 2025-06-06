import { Container, Graphics, Rectangle } from 'pixi.js'
import { BLANK } from '../common/util.js'
import { ESPER } from '../constants/index.js'
import { normalizeRectangle } from './util.js'


export class SelectionLayer extends Container {
  constructor() {
    super()
    this.on('mousemove', this.handleMouseMove)
    this.visible = false
  }

  update({ selection, tool } = BLANK) {
    if (!this.children.length) return

    const scale = 1 / this.parent.scale.y
    let i = 0

    for (; i < this.children.length - 1; ++i) {
      this.children[i].update(scale)
    }

    if (selection)
      selection = normalizeRectangle(selection)

    if (tool === ESPER.TOOL.SELECT) {
      this.children[i].update(scale, selection, 'live')
    }
  }

  destroy() {
    super.destroy({ children: true })
  }

  handleMouseMove(event) {
    const { target } = event

    if (target instanceof Selection) {
      event.stopPropagation()
      this.active = target

    } else {
      this.active = null
    }
  }

  isVisible(selection, tool) {
    return selection == null && (
      tool === ESPER.TOOL.ARROW || tool === ESPER.TOOL.SELECT
    )
  }

  getEventModeFor(tool) {
    return (tool === ESPER.TOOL.ARROW) ? 'static' : 'none'
  }

  sync(props, state) {
    let tool = state.quicktool || props.tool

    this.visible = this.isVisible(props.selection, tool)
    this.eventMode = this.getEventModeFor(tool)

    let { selections } = props

    for (let i = 0; i < selections.length; ++i) {
      if (i >= this.children.length) {
        this.addChild(new Selection())
      }

      this.children[i].sync(selections[i])
    }

    if (this.children.length <= selections.length) {
      this.addChild(new Selection())
    }

    this.children[selections.length].sync(BLANK)

    if (this.children.length > selections.length + 1) {
      for (let s of this.removeChildren(selections.length + 1)) {
        s.destroy()
      }
    }
  }
}


export class Selection extends Graphics {
  constructor() {
    super()
    this.data = BLANK
    this.eventMode = 'static'
  }

  get isBlank() {
    return this.data === BLANK
  }

  get isActive() {
    return this === this.parent.active
  }

  destroy() {
    this.data = null
    super.destroy(true)
  }

  update(
    scale = 1,
    { x, y, width, height } = this.data,
    state = this.isActive ? 'active' : 'default'
  ) {
    this.clear()
    if (!width || !height) return

    let colors = ESPER.COLOR.selection[state]

    this
      .rect(x, y, width, height)
      .fill(colors.fill)
      .stroke({ width: scale, ...colors.line })
  }

  sync(data = BLANK) {
    this.data = data

    if (this.isBlank || this.parent.eventMode !== 'none') {
      this.hitArea = null
    } else {
      this.hitArea = new Rectangle(
        data.x, data.y, data.width, data.height
      )
    }
  }
}


export class SelectionOverlay extends Container {
  constructor() {
    super()

    this.cacheAsTexture = false
    this.visible = false

    this.addChild(new Graphics(), new Graphics())
  }

  update() {
    this.children[1].clear()
    this.children[0].clear()

    if (this.active == null || this.parent == null) return

    let scale = 1 / this.parent.scale.y
    let { bg } = this.parent
    let { x, y, width, height } = this.active

    this.children[1]
      .rect(x, y, width, height)
      .fill({ color: 0, alpha: 0 })
      .stroke({ width: scale, ...ESPER.COLOR.mask.line })

    this.children[0]
      .rect(0, 0, bg.width, bg.height)
      .fill(ESPER.COLOR.mask.fill)
      .rect(x, y, width, height)
      .cut()
  }


  sync({ selection }) {
    this.active = selection
    this.children[0].clear()
    this.visible = (selection != null)
  }
}
