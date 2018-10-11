'use strict'

const React = require('react')
const lazy = require('./node')
const { get, move } = require('../../common/util')
const { arrayOf, func, number, object, shape } = require('prop-types')


class ListTree extends React.Component {
  constructor(props) {
    super(props)
    this.state = {
      order: get(props.parent, ['children'], [])
    }
  }

  get order() {
    return get(this.props.parent, ['children'], [])
  }

  componentWillReceiveProps(props) {
    this.setState({
      order: get(props.parent, ['children'], [])
    })
  }

  isEditing(id) {
    return get(this.props.edit, ['id']) === id
  }

  isSelected(id) {
    return this.props.selection === id
  }

  handleSortPreview = (item, to, offset = 0) => {
    this.setState({
      order: move(this.state.order, item, to, offset)
    })
  }

  handleSortReset = () => {
    this.setState({ order: this.order })
  }

  handleSort = () => {
    this.props.onSort({
      id: this.props.parent.id,
      children: this.state.order
    })
  }

  hasNewListNode() {
    return get(this.props.edit, 'parent') === this.props.parent.id
  }

  render() {
    return (
      <ol className="list-tree sortable" ref={this.setContainer}>
        {this.state.order.map(id =>
          <lazy.ListNode {...this.props}
            key={id}
            list={this.props.lists[id] || { id }}
            isSelected={this.isSelected(id)}
            isEditing={this.isEditing(id)}
            isHolding={this.props.hold[id]}
            isSortable
            onSortPreview={this.handleSortPreview}
            onSortReset={this.handleSortReset}
            onSort={this.handleSort}/>)}
        {this.hasNewListNode() &&
          <lazy.ListNode
            list={this.props.edit}
            isEditing
            onEditCancel={this.props.onEditCancel}
            onListSave={this.props.onListSave}/>}
      </ol>
    )
  }

  static propTypes = {
    parent: shape({
      id: number.isRequired,
      children: arrayOf(number)
    }).isRequired,
    lists: object.isRequired,
    hold: object.isRequired,
    edit: object,
    selection: number,
    onClick: func.isRequired,
    onEditCancel: func.isRequired,
    onDropFiles: func.isRequired,
    onDropItems: func.isRequired,
    onListSave: func.isRequired,
    onSort: func.isRequired,
    onContextMenu: func.isRequired
  }
}

module.exports.ListTree = ListTree
