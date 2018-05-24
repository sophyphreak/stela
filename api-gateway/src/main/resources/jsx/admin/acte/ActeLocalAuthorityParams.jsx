import React, { Component } from 'react'
import PropTypes from 'prop-types'
import renderIf from 'render-if'
import { translate } from 'react-i18next'
import { Checkbox, Form, Button, Dropdown, Segment } from 'semantic-ui-react'
import Validator from 'validatorjs'
import moment from 'moment'

import InputValidation from '../../_components/InputValidation'
import DraggablePosition from '../../_components/DraggablePosition'
import { notifications } from '../../_util/Notifications'
import { Field, Page } from '../../_components/UI'
import { checkStatus, fetchWithAuthzHandling, handleFieldCheckboxChange } from '../../_util/utils'

class ActeLocalAuthorityParams extends Component {
    static contextTypes = {
        csrfToken: PropTypes.string,
        csrfTokenHeaderName: PropTypes.string,
        t: PropTypes.func,
        _addNotification: PropTypes.func
    }
    state = {
        constantFields: {
            uuid: '',
            name: '',
            siren: '',
            nomenclatureDate: null
        },
        fields: {
            department: '',
            district: '',
            nature: '',
            canPublishRegistre: false,
            canPublishWebSite: false,
            stampPosition: {
                x: 10,
                y: 10
            },
            genericProfileUuid: ''
        },
        localAuthorityFetched: false,
        isFormValid: false,
        profiles: []
    }
    validationRules = {
        department: 'required|digits:3',
        district: 'required|digits:1',
        nature: 'required|digits:2'
    }
    componentDidMount() {
        const uuid = this.props.uuid

        const adminUrl = uuid ? `/api/admin/local-authority/${uuid}` : '/api/admin/local-authority/current'
        fetchWithAuthzHandling({ url: adminUrl })
            .then(checkStatus)
            .then(response => response.json())
            .then(json => {
                this.setState({ profiles: json.profiles })
            })
            .catch(response => {
                response.json().then(json => {
                    this.context._addNotification(notifications.defaultError, 'notifications.admin.title', json.message)
                })
            })

        const url = uuid ? '/api/acte/localAuthority/' + uuid : '/api/acte/localAuthority/current'
        fetchWithAuthzHandling({ url })
            .then(checkStatus)
            .then(response => response.json())
            .then(json => this.updateState(json))
            .catch(response => {
                response.json().then(json => {
                    this.context._addNotification(notifications.defaultError, 'notifications.acte.title', json.message)
                })
                history.push('/admin/actes/parametrage-collectivite')
            })
    }
    updateState = ({ uuid, name, siren, department, district, nature, nomenclatureDate, canPublishRegistre, canPublishWebSite, stampPosition, genericProfileUuid }) => {
        const constantFields = { uuid, name, siren, nomenclatureDate }
        const fields = { department, district, nature, canPublishRegistre, canPublishWebSite, stampPosition, genericProfileUuid }
        this.setState({ constantFields: constantFields, fields: fields, localAuthorityFetched: true }, this.validateForm)
    }
    handleFieldChange = (field, value) => {
        const fields = this.state.fields
        fields[field] = value
        this.setState({ fields: fields }, this.validateForm)
    }
    handleStateChange = (event, { id, value }) => {
        const { fields } = this.state
        fields[id] = value
        this.setState({ fields })
    }
    handleChangeDeltaPosition = (position) => {
        const { fields } = this.state
        fields.stampPosition = position
        this.setState({ fields })
    }
    validateForm = () => {
        const data = {
            department: this.state.fields.department,
            district: this.state.fields.district,
            nature: this.state.fields.nature
        }
        const validation = new Validator(data, this.validationRules)
        this.setState({ isFormValid: validation.passes() })
    }
    submitForm = (event) => {
        event.preventDefault()
        const data = JSON.stringify(this.state.fields)
        const headers = {
            'Accept': 'application/json',
            'Content-Type': 'application/json'
        }
        fetchWithAuthzHandling({ url: '/api/acte/localAuthority/' + this.state.constantFields.uuid, method: 'PATCH', body: data, headers: headers, context: this.context })
            .then(checkStatus)
            .then(response => response.json())
            .then(json => {
                this.context._addNotification(notifications.admin.localAuthorityUpdate)
                this.updateState(json)
            })
            .catch(response => {
                response.text().then(text => this.context._addNotification(notifications.defaultError, 'notifications.acte.title', text))
            })
    }
    askClassificationUpdate = (event, force = false) => {
        event.preventDefault()
        const url = `/api/acte/ask-classification${force && '-force'}/${this.props.uuid || 'current'}`
        fetchWithAuthzHandling({ url, method: 'POST', context: this.context })
            .then(checkStatus)
            .then(() => this.context._addNotification(notifications.admin.classificationAsked))
            .catch(response => {
                response.json().then(json => {
                    this.context._addNotification(notifications.defaultError, 'notifications.acte.title', json.message)
                })
            })
    }
    render() {
        const { t } = this.context
        const localAuthorityFetched = renderIf(this.state.localAuthorityFetched)
        const profiles = this.state.profiles.map(profile => { return { key: profile.uuid, value: profile.uuid, text: `${profile.agent.given_name} ${profile.agent.family_name}` } })

        return (
            localAuthorityFetched(
                <Page title={this.state.constantFields.name}>
                    <Segment>
                        <h2>{t('admin.modules.acte.module_settings.title')}</h2>

                        <Form onSubmit={this.submitForm}>
                            <Field htmlFor="nomenclatureDate" label={t('api-gateway:local_authority.nomenclatureDate')}>
                                <span id="nomenclatureDate">{moment(this.state.constantFields.nomenclatureDate).format('DD/MM/YYYY')}</span>
                                <Button basic primary style={{ marginLeft: '1em' }} onClick={this.askClassificationUpdate}>
                                    {t('admin.modules.acte.local_authority_settings.askClassification')}
                                </Button>
                                <Button basic negative style={{ marginLeft: '1em' }} onClick={e => this.askClassificationUpdate(e, true)}>
                                    {t('admin.modules.acte.local_authority_settings.askClassificationForce')}
                                </Button>
                            </Field>
                            <Field htmlFor="department" label={t('api-gateway:local_authority.department')}>
                                <InputValidation id='department'
                                    value={this.state.fields.department}
                                    onChange={this.handleFieldChange}
                                    validationRule={this.validationRules.department}
                                    fieldName={t('api-gateway:local_authority.department')}
                                    className='simpleInput' />
                            </Field>
                            <Field htmlFor="district" label={t('api-gateway:local_authority.district')}>
                                <InputValidation id='district'
                                    value={this.state.fields.district}
                                    onChange={this.handleFieldChange}
                                    validationRule={this.validationRules.district}
                                    fieldName={t('api-gateway:local_authority.district')}
                                    className='simpleInput' />
                            </Field>
                            <Field htmlFor="nature" label={t('api-gateway:local_authority.nature')}>
                                <InputValidation id='nature'
                                    value={this.state.fields.nature}
                                    onChange={this.handleFieldChange}
                                    validationRule={this.validationRules.nature}
                                    fieldName={t('api-gateway:local_authority.nature')}
                                    className='simpleInput' />
                            </Field>
                            <Field htmlFor="positionPad" label={t('acte.stamp_pad.title')}>
                                <DraggablePosition
                                    label={t('acte.stamp_pad.pad_label')}
                                    height={300}
                                    width={190}
                                    showPercents={true}
                                    labelColor='#000'
                                    position={this.state.fields.stampPosition}
                                    handleChange={this.handleChangeDeltaPosition} />
                            </Field>
                            <Field htmlFor="canPublishRegistre" label={t('api-gateway:local_authority.canPublishRegistre')}>
                                <Checkbox id="canPublishRegistre" toggle checked={this.state.fields.canPublishRegistre} onChange={e => handleFieldCheckboxChange(this, 'canPublishRegistre')} />
                            </Field>
                            <Field htmlFor='canPublishWebSite' label={t('api-gateway:local_authority.canPublishWebSite')}>
                                <Checkbox id="canPublishWebSite" toggle checked={this.state.fields.canPublishWebSite} onChange={e => handleFieldCheckboxChange(this, 'canPublishWebSite')} />
                            </Field>
                            <Field htmlFor='genericProfileUuid' label={t('api-gateway:local_authority.genericProfileUuid')}>
                                <Dropdown compact search selection
                                    id='genericProfileUuid'
                                    field='genericProfileUuid'
                                    className='simpleInput'
                                    options={profiles}
                                    value={this.state.fields.genericProfileUuid}
                                    onChange={this.handleStateChange}
                                    placeholder={`${t('api-gateway:local_authority.genericProfileUuid')}...`} />
                            </Field>
                            <div style={{ textAlign: 'right' }}>
                                <Button basic primary style={{ marginTop: '1em' }} disabled={!this.state.isFormValid} type='submit'>{t('api-gateway:form.update')}</Button>
                            </div>
                        </Form>
                    </Segment>
                </Page>
            )
        )
    }
}

export default translate(['acte', 'api-gateway'])(ActeLocalAuthorityParams)