'use strict'

const React = require('react')
const { Component } = React
const { PrefPane } = require('../prefs/pane')
const { Button } = require('../button')
const { bool, func, object, string } = require('prop-types')
const { AccordionGroup } = require('../accordion')
const { PluginAccordion } = require('./accordion')
const { values } = Object
const { uniq } = require('../../common/util')

class PluginsPane extends Component {
  constructor(props) {
    super(props)
    this.state = {
      config: props.plugins.config
    }
  }

  componentWillReceiveProps(props) {
    this.setState({
      config: props.plugins.config
    })
    this.pluginOptions = ['']
      .concat(
        uniq(
          values(this.props.plugins.spec)
          .map(s => s.name)))
  }

  onChange = (index, data) => {
    let { config } = this.state
    config[index] = data
    this.setState({ config })
    this.newPlugin = data.plugin
    this.props.onChange(config)
  }

  onDelete = (index) => {
    let { config } = this.state
    config.splice(index, 1)
    this.setState({ config })
  }

  addPlugin = () => {
    let { config } = this.state
    config = config.concat({
      options: {}
    })
    this.setState({ config })
    this.accordion.setState({ open: this.state.config.length })
  }

  setAccordion = (accordion) => {
    this.accordion = accordion
  }

  render() {
    return (
      <PrefPane
        name={this.props.name}
        isActive={this.props.isActive}>
        <div className="scroll-container">
          <AccordionGroup
            ref={this.setAccordion}
            className="form-horizontal">
            {values(this.props.plugins.spec).map(
               (spec, idx) => {
                 return (
                   <PluginAccordion
                     name={spec.name}
                     label={spec.label}
                     description={spec.description}
                     version={spec.version}
                     hooks={spec.hooks}
                     options={spec.options}
                     key={idx}/>)
               })
            }
          </AccordionGroup>
        </div>
        <footer className="plugins-footer">
          <Button
            isDefault
            text="prefs.plugins.install"
            onClick={this.addPlugin}/>
        </footer>
      </PrefPane>
    )
  }

  static propTypes = {
    isActive: bool,
    name: string.isRequired,
    plugins: object.isRequired,
    onChange: func.isRequired
  }
}

module.exports = {
  PluginsPane
}
