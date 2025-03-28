import React from 'react'
import { Scroll } from '../scroll/index.js'
import { PhotoListItem } from './list-item.js'
import { PhotoIterator } from './iterator.js'
import { SASS } from '../../constants/index.js'
import { dc } from '../../ontology/ns.js'
import cx from 'classnames'
import { match } from '../../keymap.js'


class PhotoList extends PhotoIterator {
  get classes() {
    return ['photo-list', super.classes]
  }

  isEditing(photo) {
    return this.props.edit.photo === photo.id
  }

  edit = (photo) => {
    if (photo != null && !this.props.isDisabled) {
      const { id, selection } = photo

      if (selection == null) {
        this.props.onEdit({ photo: id })
      } else {
        this.props.onEdit({ selection })
      }
    }
  }

  handleEditCancel = (...args) => {
    this.props.onEditCancel(...args)
    this.container.current.focus()
  }


  handleKeyDown = (event) => {
    switch (match(this.keymap, event)) {
      case 'left':
      case 'contract':
        if (!this.contract(this.current)) return
        break
      case 'right':
      case 'expand':
        if (!this.expand(this.current)) return
        break
      case 'edit':
      case 'enter':
        this.edit(this.current)
        break
      case 'open':
        this.handleItemOpen(this.current)
        break
      case 'preview':
        this.preview(this.current)
        break
      case 'rotateLeft':
        this.handleRotate(-90)
        break
      case 'rotateRight':
        this.handleRotate(90)
        break
      case 'delete':
        this.handleDelete(this.current)
        break
      case 'copyPhoto':
        this.handleExtract(this.current, { target: ':clipboard:' })
        break
      case 'extract':
        this.handleExtract(this.current)
        break
      default:
        return
    }

    event.preventDefault()
    event.stopPropagation()
    event.nativeEvent.stopImmediatePropagation()
  }


  render() {
    const { data, edit, onBlur, onChange } = this.props

    return this.connect(
      <div className={cx(this.classes)}>
        <Scroll
          ref={this.container}
          cursor={this.props.current}
          expansionCursor={this.props.selection}
          items={this.props.photos}
          itemHeight={SASS.ROW.HEIGHT}
          expandedItems={this.props.expandedPhotos}
          tabIndex={this.tabIndex}
          onBlur={onBlur}
          onKeyDown={this.handleKeyDown}
          onSelect={this.handleSelectPhoto}
          onTabFocus={this.props.onTabFocus}>
          {(photo, index, { isExpanded }) => (
            <PhotoListItem
              {...this.getIterableProps(photo)}
              key={photo.id}
              photo={photo}
              data={data}
              edit={edit}
              selections={this.props.selections}
              title={dc.title}
              isExpanded={isExpanded}
              isEditing={this.isEditing(photo)}
              onChange={onChange}
              onEdit={this.edit}
              onEditCancel={this.handleEditCancel}
              onSelectionSort={this.props.onSelectionSort}/>
          )}
        </Scroll>
      </div>
    )
  }

  static defaultProps = {
    ...PhotoIterator.defaultProps,
    edit: {}
  }
}


const PhotoListContainer = PhotoList.asDropTarget()

export {
  PhotoListContainer as PhotoList
}
