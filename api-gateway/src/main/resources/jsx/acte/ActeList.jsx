import React, { Component } from 'react'
import PropTypes from 'prop-types'
import moment from 'moment'
import { translate } from 'react-i18next'
import { Accordion, Form, Button, Segment } from 'semantic-ui-react'
import FileSaver from 'file-saver'

import StelaTable from '../_components/StelaTable'
import { checkStatus, fetchWithAuthzHandling } from '../_util/utils'
import { notifications } from '../_util/Notifications'
import { FormFieldInline, FormField, Page } from '../_components/UI'
import { natures, status } from '../_util/constants'

class ActeList extends Component {
    static contextTypes = {
        csrfToken: PropTypes.string,
        csrfTokenHeaderName: PropTypes.string,
        t: PropTypes.func,
        _addNotification: PropTypes.func
    }
    state = {
        actes: [],
        search: {
            number: '',
            objet: '',
            nature: '',
            status: '',
            decisionFrom: '',
            decisionTo: ''
        }
    }
    componentDidMount() {
        this.submitForm({})
    }
    handleFieldChange = (field, value) => {
        const search = this.state.search
        search[field] = value
        this.setState({ search: search })
    }
    getSearchData = () => {
        const data = {}
        Object.keys(this.state.search)
            .filter(k => this.state.search[k] !== '')
            .map(k => data[k] = this.state.search[k])
        return data
    }
    submitForm = (data) => {
        const headers = {
            'Accept': 'application/json',
            'Content-Type': 'application/json'
        }
        fetchWithAuthzHandling({ url: '/api/acte', method: 'GET', query: data, headers: headers, context: this.context })
            .then(checkStatus)
            .then(response => response.json())
            .then(json => this.setState({ actes: json }))
            .catch(response => {
                response.text().then(text => this.context._addNotification(notifications.defaultError, 'notifications.acte.title', text))
            })
    }
    downloadMergedStamp = (selectedUuids) => this.downloadFromSelectionOrSearch(selectedUuids, '/api/acte/actes.pdf', 'actes.pdf')
    downloadZipedStamp = (selectedUuids) => this.downloadFromSelectionOrSearch(selectedUuids, '/api/acte/actes.zip', 'actes.zip')
    downloadACKs = (selectedUuids) => this.downloadFromSelectionOrSearch(selectedUuids, '/api/acte/ARs.pdf', 'ARs.pdf')
    downloadCSV = (selectedUuids) => this.downloadFromSelectionOrSearch(selectedUuids, '/api/acte/actes.csv', 'actes.csv')
    downloadFromSelectionOrSearch = (selectedUuids, url, filename) => {
        const ActeUuidsAndSearchUI = Object.assign({ uuids: selectedUuids }, this.getSearchData())
        const headers = {
            'Content-Type': 'application/json'
        }
        fetchWithAuthzHandling({ url: url, body: JSON.stringify(ActeUuidsAndSearchUI), headers: headers, method: 'POST', context: this.context })
            .then(checkStatus)
            .then(response => {
                if (response.status === 204) throw response
                else return response
            })
            .then(response => response.blob())
            .then(blob => FileSaver.saveAs(blob, filename))
            .catch(response => {
                if (response.status === 204) this.context._addNotification(notifications.acte.noContent)
                else response.text().then(text => this.context._addNotification(notifications.defaultError, 'notifications.acte.title', text))
            })
    }
    render() {
        const { t } = this.context
        const statusDisplay = (history) => t(`acte.status.${history[history.length - 1].status}`)
        const natureDisplay = (nature) => t(`acte.nature.${nature}`)
        const decisionDisplay = (decision) => moment(decision).format('DD/MM/YYYY')
        const downloadACKsSelectOption = { title: t('acte.list.download_selected_ACKs'), titleNoSelection: t('acte.list.download_all_ACKs'), action: this.downloadACKs }
        const downloadCSVSelectOption = { title: t('acte.list.download_selected_CSV'), titleNoSelection: t('acte.list.download_all_CSV'), action: this.downloadCSV }
        const downloadMergedStampedsSelectOption = { title: t('acte.list.download_selected_merged_stamped'), titleNoSelection: t('acte.list.download_all_merged_stamped'), action: this.downloadMergedStamp }
        const downloadZipedStampedsSelectOption = { title: t('acte.list.download_selected_ziped_stamped'), titleNoSelection: t('acte.list.download_all_ziped_stamped'), action: this.downloadZipedStamp }
        return (
            <Page title={t('acte.list.title')}>
                <Segment>
                    <ActeListForm
                        search={this.state.search}
                        getSearchData={this.getSearchData}
                        handleFieldChange={this.handleFieldChange}
                        submitForm={this.submitForm} />
                    <StelaTable
                        data={this.state.actes}
                        metaData={[
                            { property: 'uuid', displayed: false, searchable: false },
                            { property: 'number', displayed: true, displayName: t('acte.fields.number'), searchable: true },
                            { property: 'objet', displayed: true, displayName: t('acte.fields.objet'), searchable: true },
                            { property: 'decision', displayed: true, displayName: t('acte.fields.decision'), searchable: true, displayComponent: decisionDisplay },
                            { property: 'nature', displayed: true, displayName: t('acte.fields.nature'), searchable: true, displayComponent: natureDisplay },
                            { property: 'code', displayed: false, searchable: false },
                            { property: 'creation', displayed: false, searchable: false },
                            { property: 'acteHistories', displayed: true, displayName: t('acte.fields.status'), searchable: true, displayComponent: statusDisplay },
                            { property: 'public', displayed: false, searchable: false },
                            { property: 'publicWebsite', displayed: false, searchable: false },
                        ]}
                        header={true}
                        select={true}
                        selectOptions={[downloadMergedStampedsSelectOption, downloadZipedStampedsSelectOption, downloadACKsSelectOption, downloadCSVSelectOption]}
                        link='/actes/'
                        linkProperty='uuid'
                        noDataMessage='Aucun acte'
                        keyProperty='uuid' />
                </Segment >
            </Page>
        )
    }
}

class ActeListForm extends Component {
    static contextTypes = {
        t: PropTypes.func
    }
    state = {
        isAccordionOpen: false
    }
    handleAccordion = () => {
        const isAccordionOpen = this.state.isAccordionOpen
        this.setState({ isAccordionOpen: !isAccordionOpen })
    }
    submitForm = (event) => {
        if (event) event.preventDefault()
        this.props.submitForm(this.props.getSearchData())
    }
    render() {
        const { t } = this.context
        const natureOptions = natures.map(nature =>
            <option key={nature} value={nature}>{t(`acte.nature.${nature}`)}</option>
        )
        const statusOptions = status.map(statusItem =>
            <option key={statusItem} value={statusItem}>{t(`acte.status.${statusItem}`)}</option>
        )
        return (
            <Accordion style={{ marginBottom: '1em' }} styled>
                <Accordion.Title active={this.state.isAccordionOpen} onClick={this.handleAccordion}>{t('acte.list.advanced_search')}</Accordion.Title>
                <Accordion.Content active={this.state.isAccordionOpen}>
                    <Form onSubmit={this.submitForm}>
                        <FormFieldInline htmlFor='number' label={t('acte.fields.number')} >
                            <input id='number' value={this.props.search.number} onChange={e => this.props.handleFieldChange('number', e.target.value)} />
                        </FormFieldInline>
                        <FormFieldInline htmlFor='objet' label={t('acte.fields.objet')} >
                            <input id='objet' value={this.props.search.objet} onChange={e => this.props.handleFieldChange('objet', e.target.value)} />
                        </FormFieldInline>
                        <FormFieldInline htmlFor='decisionFrom' label={t('acte.fields.decision')}>
                            <Form.Group style={{ marginBottom: 0 }} widths='equal'>
                                <FormField htmlFor='decisionFrom' label={t('api-gateway:form.from')}>
                                    <input type='date' id='decisionFrom' value={this.props.search.decisionFrom} onChange={e => this.props.handleFieldChange('decisionFrom', e.target.value)} />
                                </FormField>
                                <FormField htmlFor='decisionTo' label={t('api-gateway:form.to')}>
                                    <input type='date' id='decisionTo' value={this.props.search.decisionTo} onChange={e => this.props.handleFieldChange('decisionTo', e.target.value)} />
                                </FormField>
                            </Form.Group>
                        </FormFieldInline>
                        <FormFieldInline htmlFor='nature' label={t('acte.fields.nature')}>
                            <select id='nature' value={this.props.search.nature} onChange={e => this.props.handleFieldChange('nature', e.target.value)}>
                                <option value=''>{t('api-gateway:form.all_feminine')}</option>
                                {natureOptions}
                            </select>
                        </FormFieldInline>
                        <FormFieldInline htmlFor='status' label={t('acte.fields.status')}>
                            <select id='status' value={this.props.search.status} onChange={e => this.props.handleFieldChange('status', e.target.value)}>
                                <option value=''>{t('api-gateway:form.all')}</option>
                                {statusOptions}
                            </select>
                        </FormFieldInline>
                        <Button type='submit' basic primary>{t('api-gateway:form.search')}</Button>
                    </Form>
                </Accordion.Content>
            </Accordion>
        )
    }
}

export default translate(['acte', 'api-gateway'])(ActeList)