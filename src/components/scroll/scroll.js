import React from 'react'
import { array, func, number, string } from 'prop-types'
import { Range } from './range'
import { Runway } from './runway'
import { ScrollContainer } from './container'
import { getExpandedRows, getExpandedRowsAbove } from './expansion'
import { Viewport } from './viewport'
import { restrict } from '../../common/util'
import memoize from 'memoize-one'


export class Scroll extends React.Component {
  container = React.createRef()

  state = {
    // Derived from container size
    width: 0,
    height: 0,

    // Derived from scroll position
    offset: 0,
    row: 0,
    numRowsAbove: 0,
    expRowPosition: 0
  }

  componentDidMount() {
    this.handleResize(this.container.current.bounds)
  }

  get tabIndex() {
    return this.props.items.length === 0 ? null : this.props.tabIndex
  }

  get transform() {
    return `translate3d(0,${this.state.offset}px,0)`
  }

  focus() {
    this.container.current.focus()
  }

  getComputedLayout = memoize((
    items,
    itemHeight,
    itemWidth,
    height,
    width,
    expandedItems,
    expansionPadding,
    overscan
  ) => {
    let columns = Math.floor(width / itemWidth) || 1

    let expandedRows = getExpandedRows(
      columns,
      items,
      expandedItems,
      itemWidth > 0)

    let rows = Math.ceil(items.length / columns) + expandedRows.length
    let visibleRows = Math.ceil(height / itemHeight)
    let overscanRows = Math.max(2, Math.ceil(visibleRows * overscan))
    let rowsPerPage = visibleRows + overscanRows

    let runway = rows * itemHeight

    if (expandedItems.length > 0)
      runway += expansionPadding

    let pageOffset = Math.floor(overscanRows / 2) * itemHeight

    let maxOffset = runway - (rowsPerPage * itemHeight)
    maxOffset = Math.max(maxOffset - (maxOffset % itemHeight), 0)

    return {
      columns,
      expandedRows,
      rows,
      rowsPerPage,
      runway,
      pageOffset,
      maxOffset
    }
  })

  handleResize = ({ width, height }) => {
    this.setState({ width, height }, () => {
      this.handleScroll()
    })
  }

  handleScroll = () => {
    if (!this.#scrollCallback.current) {
      this.#scrollCallback.current =
        requestAnimationFrame(this.#scrollCallback)
    }
  }

  #scrollCallback = () => {
    this.#scrollCallback.current = null
    this.handleScrollUpdate(this.container.current.scrollTop)
  }

  handleScrollUpdate(top) {
    let { itemHeight, expansionPadding } = this.props
    let { expandedRows, maxOffset, pageOffset } = this.layout

    let offset = restrict(
      top - (top % itemHeight) - pageOffset,
      0,
      maxOffset)

    let row = Math.floor(offset / itemHeight)

    let { numRowsAbove, expRowPosition } =
        getExpandedRowsAbove(expandedRows, row)

    if (expandedRows.length) {
      offset = (row - expRowPosition) * itemHeight

      if (numRowsAbove > 0 && expRowPosition === 0)
        offset += expansionPadding
    }

    this.setState({
      offset,
      row,
      numRowsAbove,
      expRowPosition
    })
  }

  pageUp() {
    this.scrollBy(-this.state.height)
  }

  pageDown() {
    this.scrollBy(this.state.height)
  }

  toEnd() {
    this.scroll(this.layout.runway - this.state.height)
  }

  scroll(...args) {
    this.container.current.scroll(...args)
  }

  scrollBy(...args) {
    this.container.current.scroll(...args)
  }

  scrollIntoView(idx, { force } = {}) {
    let { columns } = this.layout
    let { itemHeight } = this.props
    let { height } = this.state

    let top = this.container.current.scrollTop
    let offset = Math.floor(idx / columns) * itemHeight

    // TODO adjust expansion rows and padding

    let bottom = offset + itemHeight
    let isBelow = bottom > top

    // Don't scroll if item already in viewport!
    if (!force && isBelow && bottom <= top + height)
      return

    if (isBelow)
      offset += itemHeight - height

    this.scroll(offset)
  }

  render() {
    this.layout = this.getComputedLayout(
      this.props.items,
      this.props.itemHeight,
      this.props.itemWidth,
      this.state.height,
      this.state.width,
      this.props.expandedItems,
      this.props.expansionPadding,
      this.props.overscan)

    let { columns, rowsPerPage, runway } = this.layout
    let { row, numRowsAbove } = this.state

    let from = columns * Math.max(0, row - numRowsAbove)
    let to = Math.min(from + (columns * rowsPerPage), this.props.items.length)

    return (
      <ScrollContainer
        ref={this.container}
        onClick={this.props.onClick}
        onKeyDown={this.props.onKeyDown}
        onResize={this.handleResize}
        onScroll={this.handleScroll}
        onTabFocus={this.props.onTabFocus}
        tabIndex={this.tabIndex}>
        <Runway height={runway}>
          <Viewport
            tag={this.props.tag}
            columns={columns}
            transform={this.transform}>
            <Range
              columns={columns}
              items={this.props.items}
              from={from}
              to={to}
              expandedItems={this.props.expandedItems}
              renderExpansionRow={this.props.renderExpansionRow}
              renderItem={this.props.children}/>
          </Viewport>
        </Runway>
      </ScrollContainer>
    )
  }

  static propTypes = {
    children: func.isRequired,
    expandedItems: array.isRequired,
    expansionPadding: number.isRequired,
    items: array.isRequired,
    itemWidth: number,
    itemHeight: number.isRequired,
    onClick: func,
    onKeyDown: func,
    onTabFocus: func,
    overscan: number.isRequired,
    renderExpansionRow: func,
    tabIndex: number,
    tag: string
  }

  static defaultProps = {
    expandedItems: [],
    expansionPadding: 0,
    items: [],
    overscan: 1.25
  }
}