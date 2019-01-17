import React, { Component } from 'react'
import PropTypes from 'prop-types'
import { translate } from 'react-i18next'
import { Segment, Form, Grid, Checkbox, Button, Modal } from 'semantic-ui-react'
import Validator from 'validatorjs'
import debounce from 'debounce'

import { withAuthContext } from '../../Auth'

import { notifications } from '../../_util/Notifications'
import { checkStatus, getLocalAuthoritySlug } from '../../_util/utils'
import history from '../../_util/history'
import InputValidation from '../../_components/InputValidation'
import RecipientForm from '../../convocation/RecipientForm'
import Breadcrumb from '../../_components/Breadcrumb'

import { Page, FormField, ValidationPopup} from '../../_components/UI'
import ChipsList from '../../_components/ChipsList'

class AssemblyTypeConfig extends Component {
	static contextTypes = {
	    t: PropTypes.func,
	    _addNotification: PropTypes.func,
	    _fetchWithAuthzHandling: PropTypes.func
	}
	validationRules = {
	    name: 'required',
	    location: 'required',
	    delay: ['required']
	}
	state = {
	    formErrors: [],
	    isFormValid: false,
	    errorTypePointing: false,
	    fields: {
	        uuid: null,
	        name: '',
	        location: '',
	        delay: '',
	        reminder: true,
	        useProcuration: false,
	        recipients: []
	    },
	    modalOpened: false
	}
	componentDidMount() {
	    const { _fetchWithAuthzHandling, _addNotification } = this.context
	    const uuid = this.props.uuid
	    if(uuid) {
	        _fetchWithAuthzHandling({ url: '/api/convocation/assembly-type/' + uuid })
	            .then(checkStatus)
	            .then(response => response.json())
	            .then(json => {
	                const fields = this.state.fields
	                Object.keys(fields).forEach(function (key) {
	                    fields[key] = json[key]
	                })
	                this.setState({fields}, this.validateForm)
	            })
	            .catch(response => {
	                response.json().then(json => {
	                    _addNotification(notifications.defaultError, 'notifications.title', json.message)
	                })
	            })
	    } else {
	        _fetchWithAuthzHandling({url: '/api/convocation/assembly-type/delay'})
	            .then(checkStatus)
	            .then(response => response.json())
	            .then(json => {
	                const fields = this.state.fields
	                fields['delay'] = json.delay
	                this.setState({fields})
	            })
	            .catch(response => {
	                response.json().then(json => {
	                    _addNotification(notifications.defaultError, 'notifications.title', json.message)
	                })
	            })
	    }
	}
	submitForm = () => {
	    const { t, _fetchWithAuthzHandling, _addNotification } = this.context
	    const localAuthoritySlug = getLocalAuthoritySlug()
	    const parameters = Object.assign({}, this.state.fields)
	    delete parameters.uuid

	    const headers = { 'Content-Type': 'application/json' }
	    _fetchWithAuthzHandling({url: '/api/convocation/assembly-type' + (this.state.fields.uuid ? `/${this.state.fields.uuid}` : ''), method: this.state.fields.uuid ? 'PUT' : 'POST', headers: headers, body: JSON.stringify(parameters), context: this.props.authContext})
	        .then(checkStatus)
	        .then(() => {
	            if(this.state.fields.uuid) {
	                _addNotification(this.state.fields.uuid ? notifications.admin.assemblyTypeUpdated : notifications.admin.assembly_type_updated)
	            } else {
	                _addNotification(this.state.fields.uuid ? notifications.admin.assemblyTypeCreated : notifications.admin.assembly_type_created)
	            }
	            history.push(`/${localAuthoritySlug}/admin/convocation/type-assemblee/liste-type-assemblee`)
	        })
	        .catch(response => {
	            response.json().then((json) => {
	                _addNotification(notifications.defaultError, 'api-gateway:notifications.admin.title', t(`convocation.${json.message}`))
	            })
	        })
	}
	cancel = () => {
	    history.goBack()
	}
	extractFieldNameFromId = (str) => str.split('_').slice(-1)[0]
	handleFieldChange = (field, value, callback) => {
	    //To COMPLETE
	    //Set set for thid field
	    field = this.extractFieldNameFromId(field)
	    const fields = this.state.fields
	    fields[field] = ((field === 'delay') && value)? parseInt(value): value
	    this.setState({ fields: fields }, () => {
	        this.validateForm()
	        if (callback) callback()
	    })
	}
	validateForm = debounce(() => {
	    const { t } = this.context
	    const data = {
	        name: this.state.fields.name,
	        location: this.state.fields.location,
	        delay: this.state.fields.delay,
	        reminder: this.state.fields.reminder
	    }
	    const attributeNames = {
	        name: t('convocation.admin.modules.convocation.assembly_type_config.type'),
	        location: t('convocation.admin.modules.convocation.assembly_type_config.place'),
	        delay: t('convocation.admin.modules.convocation.assembly_type_config.convocation_delay'),
	        reminder: t('convocation.admin.modules.convocation.assembly_type_config.reminder_time')
	    }
	    const validationRules = this.validationRules

	    const validation = new Validator(data, validationRules)
	    validation.setAttributeNames(attributeNames)
	    const isFormValid = validation.passes()
	    const formErrors = Object.values(validation.errors.all()).map(errors => errors[0])
	    this.setState({ isFormValid, formErrors })
	}, 500)
	closeModal = () => {
	    this.setState({modalOpened: false})
	}
	addRecipient = (selectedUser) => {
	    const fields = this.state.fields
	    fields['recipients'] = selectedUser
	    this.setState({fields})
	    this.closeModal()
	}
	handleCheckbox = (checked, field) => {
	    const fields = this.state.fields
	    fields[field] = checked
	    this.setState({ fields: fields })
	}
	render () {
	    const { t } = this.context
	    const submissionButton =
			<Button type='submit' primary basic disabled={!this.state.isFormValid }>
			    {t('api-gateway:form.send')}
			</Button>
	    const localAuthoritySlug = getLocalAuthoritySlug()
	    const dataBreadcrumb = this.props.uuid ? [
	        {title: t('api-gateway:breadcrumb.admin_home'), url: `/${localAuthoritySlug}/admin/ma-collectivite`},
	        {title: t('api-gateway:breadcrumb.convocation.convocation'), url: `/${localAuthoritySlug}/admin/convocation/parametrage-module`},
	        {title: t('api-gateway:breadcrumb.convocation.assembly_type_list'), url: `/${localAuthoritySlug}/admin/convocation/type-assemblee/liste-type-assemblee` },
	        {title: t('api-gateway:breadcrumb.convocation.edit_assembly_type') }
	    ] : [
	        {title: t('api-gateway:breadcrumb.admin_home'), url: `/${localAuthoritySlug}/admin/ma-collectivite`},
	        {title: t('api-gateway:breadcrumb.convocation.convocation'), url: `/${localAuthoritySlug}/admin/convocation/parametrage-module`},
	        {title: t('api-gateway:breadcrumb.convocation.add_assembly_type') }
	    ]
	    return (
	        <Page>
	            <Breadcrumb
	                data={dataBreadcrumb}
	            />
	            <Segment>
	                <Form onSubmit={this.submitForm}>
	                    <Grid>
	                        <Grid.Column mobile="16" computer='8'>
	                            <FormField htmlFor={`${this.state.fields.uuid}_name`}
	                                label={t('convocation.admin.modules.convocation.assembly_type_config.type')} required={true}>
	                                <InputValidation
	                                    errorTypePointing={this.state.errorTypePointing}
	                                    id={`${this.state.fields.uuid}_name`}
	                                    value={this.state.fields.name}
	                                    onChange={this.handleFieldChange}
	                                    validationRule={this.validationRules.name}
	                                    fieldName={t('convocation.admin.modules.convocation.assembly_type_config.type')}
	                                    ariaRequired={true}
	                                />
	                            </FormField>
	                        </Grid.Column>
	                        <Grid.Column mobile="16" computer='8'>
	                            <FormField htmlFor={`${this.state.fields.uuid}_location`}
	                                label={t('convocation.admin.modules.convocation.assembly_type_config.place')} required={true}>
	                                <InputValidation
	                                    errorTypePointing={this.state.errorTypePointing}
	                                    id={`${this.state.fields.uuid}_location`}
	                                    value={this.state.fields.location}
	                                    onChange={this.handleFieldChange}
	                                    validationRule={this.validationRules.location}
	                                    fieldName={t('convocation.admin.modules.convocation.assembly_type_config.place')}
	                                    ariaRequired={true}
	                                />
	                            </FormField>
	                        </Grid.Column>
	                        <Grid.Column mobile="16" computer='8'>
	                            <FormField htmlFor={`${this.state.fields.uuid}_delay`}
	                                label={t('convocation.admin.modules.convocation.assembly_type_config.convocation_delay')} required={true}>
	                                <InputValidation
	                                    errorTypePointing={this.state.errorTypePointing}
	                                    id={`${this.state.fields.uuid}_delay`}
	                                    validationRule={this.validationRules.delay}
	                                    value={this.state.fields.delay}
	                                    type='number'
	                                    onChange={this.handleFieldChange}
	                                    fieldName={t('convocation.admin.modules.convocation.assembly_type_config.convocation_delay')}
	                                    ariaRequired={true}
	                                />
	                            </FormField>
	                        </Grid.Column>
	                        <Grid.Column mobile="16" computer='8'>
	                            <FormField htmlFor={`${this.state.fields.uuid}_reminder`}
	                                label={t('convocation.admin.modules.convocation.assembly_type_config.reminder')} required={true}>
	                                <Checkbox className='secondary'
	                                    checked={this.state.fields.reminder}
	                                    onChange={((e, { checked }) => this.handleCheckbox(checked, 'reminder'))}/>
	                                {/* <InputValidation
	                                    errorTypePointing={this.state.errorTypePointing}
	                                    id={`${this.state.fields.uuid}_reminder`}
	                                    validationRule={this.validationRules.reminder}
	                                    value={this.state.fields.reminder}
	                                    onChange={this.handleFieldChange}
	                                    fieldName={t('convocation.admin.modules.convocation.assembly_type_config.reminder')}
	                                    ariaRequired={true}
	                                /> */}
	                            </FormField>
	                        </Grid.Column>
	                        <Grid.Column mobile="16" computer='8'>
	                            <FormField htmlFor={`${this.state.fields.uuid}_useProcuration`}
	                                label={t('convocation.admin.modules.convocation.assembly_type_config.procuration')}>
	                                <Checkbox toggle className='secondary'
	                                    checked={this.state.fields.useProcuration}
	                                    onChange={((e, { checked }) => this.handleCheckbox(checked, 'useProcuration'))}/>
	                            </FormField>
	                        </Grid.Column>
	                        <Grid.Column computer='16'>
	                            <FormField htmlFor={`${this.state.fields.uuid}_recipient`}
	                                label={t('convocation.admin.modules.convocation.assembly_type_config.recipients')} required={true}>
	                                <Modal open={this.state.modalOpened} trigger={<Button
	                                    	onClick={() => this.setState({modalOpened: true})}
	                                    	type='button'
	                                    	id={`${this.state.fields.uuid}_recipient`}
	                                    	compact basic primary>{t('convocation.admin.modules.convocation.assembly_type_config.edit_recipients')}
	                                    </Button>}>
	                                    <RecipientForm
	                                        onCloseModal={this.closeModal}
	                                        onAdded={(selectedUser) => this.addRecipient(selectedUser)}
	                                        selectedUser={this.state.fields.recipients}>
	                                    </RecipientForm>
	                                </Modal>
	                            </FormField>
	                            <ChipsList
	                                list={this.state.fields.recipients}
	                                labelText='email'
	                                removable={false}
	                                viewMoreText={t('convocation.new.view_more_recipients', {number: this.state.fields.recipients.length})}
	                                viewLessText={t('convocation.new.view_less_recipients')}/>
	                        </Grid.Column>
	                    </Grid>
	                    <div className='footerForm'>
	                        <Button type="button" style={{ marginRight: '1em' }} onClick={e => this.cancel()} basic color='red'>
	                            {t('api-gateway:form.cancel')}
	                        </Button>

	                        {this.state.formErrors.length > 0 &&
                                <ValidationPopup errorList={this.state.formErrors}>
                                    {submissionButton}
                                </ValidationPopup>
	                        }
	                        {this.state.formErrors.length === 0 && submissionButton}
	                    </div>
	                </Form>
	            </Segment>
	        </Page>
	    )
	}
}

export default translate(['convocation', 'api-gateway'])(withAuthContext(AssemblyTypeConfig))