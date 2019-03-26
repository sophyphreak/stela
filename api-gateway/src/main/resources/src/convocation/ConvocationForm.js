import React, { Component, Fragment } from 'react'
import { translate } from 'react-i18next'
import { Segment, Form, TextArea, Grid, Button } from 'semantic-ui-react'
import PropTypes from 'prop-types'
import debounce from 'debounce'
import moment from 'moment'
import Validator from 'validatorjs'
import accepts from 'attr-accept'

import { getLocalAuthoritySlug, checkStatus, extractFieldNameFromId } from '../_util/utils'
import { notifications } from '../_util/Notifications'
import history from '../_util/history'
import { acceptFileDocumentConvocation } from '../_util/constants'
import ConvocationService from '../_util/convocation-service'


import { withAuthContext } from '../Auth'

import ConfirmModal from '../_components/ConfirmModal'
import { Page, FormField, InputTextControlled, ValidationPopup, File, InputFile, LinkFile } from '../_components/UI'
import InputValidation from '../_components/InputValidation'
import QuestionsForm from './QuestionsForm'
import AddRecipientsGuestsFormFragment from './_components/AddRecipientsGuestsFormFragment'
import Breadcrumb from '../_components/Breadcrumb'

class ConvocationForm extends Component {
	static contextTypes = {
	    t: PropTypes.func,
	    _fetchWithAuthzHandling: PropTypes.func,
	    _addNotification: PropTypes.func,
	}
	state = {
	    errorTypePointing: false,
	    modalGuestOpened: false,
	    fields: {
	        uuid: '',
	        meetingDate: '',
	        hour: '',
	        assemblyType: '',
	        location: '',
	        subject: '',
	        comment: '',
	        questions: [],
	        recipients: [],
	        guests: [],
	        file: null,
	        annexes: [],
	        sending: false,
	        defaultProcuration: null,
	        customProcuration: null,
	        useProcuration: false
	    },
	    delayTooShort: false,
	    delay: null,
	    showAllAnnexes: false,
	    assemblyTypes: [],
	    isFormValid: false,
	    allFormErrors: [],
	    localAuthority: {
	        epci: false
	    }
	}
	componentDidMount = async () => {
	    this.validateForm(null)
	    const { _fetchWithAuthzHandling, _addNotification } = this.context
	    this._convocationService = new ConvocationService()

	    const localAuthorityResponse = await this._convocationService.getConfForLocalAuthority(this.props.authContext)

	    _fetchWithAuthzHandling({url: '/api/convocation/assembly-type/all', method: 'GET'})
	        .then(checkStatus)
	        .then(response => response.json())
	        .then(json => this.setState({localAuthority: localAuthorityResponse, assemblyTypes: json.map(item => { return {key: item.uuid, text: item.name, uuid: item.uuid, value: item.uuid}})}))
	        .catch(response => {
	            response.json().then(json => {
	                _addNotification(notifications.defaultError, 'notifications.title', json.message)
	            })
	        })
	}
	validationRules = {
	    meetingDate: ['required', 'date'],
	    hour: ['required', 'regex:/^[0-9]{2}[:][0-9]{2}$/'],
	    assemblyType: 'required',
	    location: ['required'],
	    subject: 'required|max:500',
	    file: ['required']
	}
	checkDelay = () => {
	    if(this.state.fields.meetingDate && this.state.delay) {
	        const { fields, delay } = this.state
	        const now = moment()
	        const diff = fields.meetingDate.diff(now, 'days')
	        if(diff > delay) {
	            this.setState({delayTooShort: false})
	        } else {
	            this.setState({delayTooShort: true})
	        }
	    }
	}
	submit = () => {
	    if(this.state.isFormValid) {
	        const { _fetchWithAuthzHandling, _addNotification } = this.context
	        const localAuthoritySlug = getLocalAuthoritySlug()

	        const parameters = Object.assign({}, this.state.fields)
	        delete parameters.uuid
	        delete parameters.file
	        delete parameters.annexes
	        parameters.guests.forEach((guest) => {
			   guest.guest = true
			   parameters.recipients.push(guest)
	        })
	        delete parameters.guests
	        parameters['assemblyType'] = {uuid: parameters.assemblyType}
	        parameters['meetingDate'] = moment(`${parameters['meetingDate'].format('YYYY-MM-DD')} ${parameters['hour']}`, 'YYYY-MM-DD HH:mm').format('YYYY-MM-DDTHH:mm:ss')
	        const headers = { 'Content-Type': 'application/json;charset=UTF-8', 'Accept': 'application/json, */*' }
	        _fetchWithAuthzHandling({url: '/api/convocation', method: 'POST', body: JSON.stringify(parameters), context: this.props.authContext, headers: headers})
	            .then(checkStatus)
	            .then(response => response.json())
	            .then((json) => {
	                this.setState({sending: true})
	                _addNotification(notifications.convocation.created)
	                const data = new FormData()
	                data.append('file', this.state.fields.file)
	                if(this.state.fields.annexes.length > 0) {
	                    this.state.fields.annexes.forEach(annexe => {
	                        data.append('annexes', annexe)
	                    })
	                }
	                if(this.state.fields.customProcuration) {
	                    data.append('procuration', this.state.fields.customProcuration)
	                }
	                _fetchWithAuthzHandling({url: `/api/convocation/${json.uuid}/upload`, method: 'POST', body: data, context: this.props.authContext})
	                	.then(checkStatus)
	                	.then(() => {
	                		_addNotification(notifications.convocation.sent)
	                		history.push(`/${localAuthoritySlug}/convocation/liste-envoyees`)
	                	})
	                .catch((error) => {
	                	error.json().then(json => {
	                		_addNotification(notifications.defaultError, 'notifications.title', json.message)
	                	})
	                })
	            })
	            .catch((error) => {
	                error.json().then(json => {
	                    _addNotification(notifications.defaultError, 'notifications.title', json.message)
	                })
	            })
	    }
	}
	validateForm = debounce(() => {
	    const { t } = this.context
	    const data = {
	        meetingDate: this.state.fields.meetingDate,
	        hour: this.state.fields.hour,
	        assemblyType: this.state.fields.assemblyType,
	        location: this.state.fields.location,
	        subject: this.state.fields.subject,
	        file: this.state.fields.file
	    }

	    const attributeNames = {
	        meetingDate: t('convocation.fields.date'),
	        hour: t('convocation.fields.hour'),
	        assemblyType: t('convocation.fields.assembly_type'),
	        location: t('convocation.fields.assembly_place'),
	        subject: t('convocation.fields.object'),
	        file: t('convocation.fields.convocation_document')
	    }
	    const validationRules = this.validationRules
	    //add validation format file

	    const validation = new Validator(data, validationRules)
	    validation.setAttributeNames(attributeNames)
	    const isFormValid = validation.passes()
	    const allFormErrors = Object.values(validation.errors.all()).map(errors => errors[0])
	    this.setState({ isFormValid, allFormErrors })

	    this.checkDelay()
	})
	handleFieldChange = (field, value, callback) => {
	    //Set set for thid field
	    field = extractFieldNameFromId(field)
	    if(field === 'assemblyType') {
	        const { _fetchWithAuthzHandling, _addNotification } = this.context
	        _fetchWithAuthzHandling({url: `/api/convocation/assembly-type/${value}`, method: 'GET'})
	            .then(checkStatus)
	            .then(response => response.json())
	            .then(json => {
	                const fields = this.state.fields
	                fields.recipients = json.recipients
	                fields.location = json.location
	                fields.useProcuration = json.useProcuration
	                this.setState({fields, delay: json.delay})
	            })
	            .catch(response => {
	                response.json().then(json => {
	                    _addNotification(notifications.defaultError, 'notifications.title', json.message)
	                })
	            })
	    }
	    const fields = this.state.fields
	    fields[field] = value
	    this.setState({ fields: fields }, () => {
	        this.validateForm()
	        if (callback) callback()
	    })
	}

	updateUser = (fields) => {
	    this.setState({fields})
	}
	updateQuestions = (questions) => {
	    const fields = this.state.fields
	    fields['questions'] = questions
	    this.setState({fields})
	}

	acceptsFile = (file, acceptType) => {
	    const { _addNotification, t } = this.context
	    if(accepts(file, acceptType)) {
	        return true
	    } else {
	        _addNotification(notifications.defaultError, 'notifications.convocation.title', t('api-gateway:form.validation.bad_extension_file', {name: file.name}))
	        return false
	    }
	}

	handleFileChange = (field, file, acceptType) => {
	    if(this.acceptsFile(file, acceptType)) {
	        const fields = this.state.fields

	        if (file) {
	            fields[field] = file
	            this.setState({ fields }, this.validateForm)
	        }
	    }
	}


	handleAnnexeChange = (file, acceptType) => {
	    const fields = this.state.fields
	    for(let i = 0; i < file.length; i++) {
	        if(this.acceptsFile(file[i], acceptType)) {
	            fields['annexes'].push(file[i])
	        }
	    }

	    this.setState({ fields })
	}

	deleteFile = (field) => {
	    const fields = this.state.fields
	    fields[field] = null
	    this.setState({ fields }, this.validateForm)
	}

	deleteAnnexe = (index) => {
	    const fields = this.state.fields
	    fields['annexes'].splice(index, 1)
	    this.setState({ fields })
	}

	goBack = () => {
	    history.goBack()
	}

	render() {
	    const { t } = this.context

	    const submissionButton = this.state.delayTooShort ?
	        <ConfirmModal onConfirm={this.submit} text={t('convocation.new.delayTooShort', {number: this.state.delay})}>
	            <Button type='button' basic color={'orange'} disabled={!this.state.isFormValid}>{t('api-gateway:form.send')}</Button>
	        </ConfirmModal> :
	        <Button type='submit' primary basic disabled={!this.state.isFormValid}>
	            {t('api-gateway:form.send')}
	        </Button>
	    const localAuthoritySlug = getLocalAuthoritySlug()

	    const annexesToDisplay = !this.state.showAllAnnexes && this.state.fields.annexes.length > 3 ? this.state.fields.annexes.slice(0,3) : this.state.fields.annexes
	    const annexes = annexesToDisplay.map((annexe, index)=> {
	        return (
	            <File
	                key={`${this.state.fields.uuid}_${annexe.name}`}
	                attachment={{ filename: annexe.name }}
	                onDelete={() => this.deleteAnnexe(index)} />
	        )
	    })

	    return (
	        <Page>
	            <Breadcrumb
	                data={[
	                    {title: t('api-gateway:breadcrumb.home'), url: `/${localAuthoritySlug}`},
	                    {title: t('api-gateway:breadcrumb.convocation.convocation')},
	                    {title: t('api-gateway:breadcrumb.convocation.convocation_creation')}
	                ]}
	            />
	            <Form onSubmit={this.submit} className='mt-14'>
	                {/* Global information (date, assembly type, Object, comment, ...) */}
	            	<Segment>
	                    <Grid>
	                        <Grid.Column mobile='16' computer='8'>
	                            <FormField htmlFor={`${this.state.fields.uuid}_meetingDate`}
	                                label={t('convocation.fields.date')} required={true}>
	                                <InputValidation
	                                    errorTypePointing={this.state.errorTypePointing}
	                                    id={`${this.state.fields.uuid}_meetingDate`}
	                                    value={this.state.fields.meetingDate}
	                                    type='date'
	                                    onChange={this.handleFieldChange}
	                                    validationRule={this.validationRules.meetingDate}
	                                    fieldName={t('convocation.fields.date')}
	                                    placeholder={t('convocation.fields.date_placeholder')}
	                                    isValidDate={(current) => current.isAfter(new moment())}
	                                    ariaRequired={true}/>
	                            </FormField>
	                        </Grid.Column>
	                        <Grid.Column mobile='16' computer='8'>
	                            <FormField htmlFor={`${this.state.fields.uuid}_hour`}
	                                label={t('convocation.fields.hour')} required={true}>
	                                <InputValidation
	                                    errorTypePointing={this.state.errorTypePointing}
	                                    id={`${this.state.fields.uuid}_hour`}
	                                    type='time'
	                                    dropdown={true}
	                                    placeholder={t('convocation.fields.hour_placeholder')}
	                                    ariaRequired={true}
	                                    validationRule={this.validationRules.hour}
	                                    value={this.state.fields.hour}
	                                    fieldName={t('convocation.fields.hour')}
	                                    onChange={this.handleFieldChange}
	                                />
	                            </FormField>
	                        </Grid.Column>
	                        <Grid.Column mobile='16' computer='8'>
	                            <FormField htmlFor={`${this.state.fields.uuid}_assemblyType`}
	                                label={t('convocation.fields.assembly_type')} required={true}>
	                                <InputValidation
	                                    errorTypePointing={this.state.errorTypePointing}
	                                    id={`${this.state.fields.uuid}_assemblyType`}
	                                    type='dropdown'
	                                    validationRule={this.validationRules.assemblyType}
	                                    fieldName={t('convocation.fields.assembly_type')}
	                                    ariaRequired={true}
	                                    options={this.state.assemblyTypes}
	                                    value={this.state.fields.assemblyType}
	                                    onChange={this.handleFieldChange}
	                                />
	                            </FormField>
	                        </Grid.Column>
	                        <Grid.Column mobile='16' computer='8'>
	                            <FormField htmlForm={`${this.state.fields.uuid}_location`}
	                                label={t('convocation.fields.assembly_place')} required={true}>
	                                <InputValidation
	                                    errorTypePointing={this.state.errorTypePointing}
	                                    validationRule={this.validationRules.location}
	                                    id={`${this.state.fields.uuid}_location`}
	                                    fieldName={t('convocation.fields.assembly_place')}
	                                    onChange={this.handleFieldChange}
	                                    value={this.state.fields.location}
	                                />
	                            </FormField>
	                        </Grid.Column>
	                        <Grid.Column computer='16'>
	                            <FormField htmlFor={`${this.state.fields.uuid}_subject`}
	                                label={t('convocation.fields.object')}
                        			required={true}>
	                                <InputValidation id={`${this.state.fields.uuid}_subject`}
	                                    errorTypePointing={this.state.errorTypePointing}
	                                    ariaRequired={true}
	                                    validationRule={this.validationRules.subject}
	                                    fieldName={t('convocation.fields.object')}
	                                    placeholder={t('convocation.fields.object_placeholder')}
	                                    value={this.state.fields.subject}
	                                    onChange={this.handleFieldChange}/>
	                            </FormField>
	                        </Grid.Column>
	                        <Grid.Column computer='16'>
	                            <FormField htmlFor={`${this.state.fields.uuid}_comment`}
	                                label={t('convocation.fields.comment')}>
	                                <InputTextControlled component={TextArea}
	                                    id={`${this.state.fields.uuid}_comment`}
	                                    maxLength={250}
	                                    style={{ minHeight: '3em' }}
	                                    placeholder={`${t('convocation.fields.comment')}...`}
	                                    value={this.state.fields.comment}
	                                    onChange={this.handleFieldChange} />
	                            </FormField>
	                        </Grid.Column>
	                    </Grid>
	                </Segment>
	                {/* Questions */}
	                <Segment>
	                    <Grid>
	                        <Grid.Column mobile='16' computer='16'>
	                            {this.state.initialRank !== null && (
	                                <QuestionsForm
	                                    editable={true}
	                                    questions={this.state.fields.questions}
	                                    initialRank={this.state.initialRank}
	                                    onUpdateQuestions={this.updateQuestions}
	                                />
	                            )}
	                        </Grid.Column>
	                    </Grid>
	                </Segment>
	                {/* Documents */}
	                <Segment>
	                    <Grid>
	                        {this.state.fields.useProcuration && (
	                            <Fragment>
	                                <Grid.Column mobile='16' computer='8'>
	                                    <FormField htmlFor={`${this.state.fields.uuid}_procuration`}
	                                        label={t('convocation.fields.default_procuration')}>
	                                        <LinkFile url='/api/convocation/local-authority/procuration' text={t('convocation.new.display')}/>
	                                    </FormField>
	                                </Grid.Column>
	                                <Grid.Column mobile='16' computer='8'>
	                                    <FormField htmlFor={`${this.state.fields.uuid}_customProcuration`}
	                                        label={t('convocation.fields.custom_procuration')}>
	                                        <InputFile labelClassName="primary" htmlFor={`${this.state.fields.uuid}_customProcuration`}
	                                            label={`${t('api-gateway:form.add_a_file')}`}>
	                                            <input type="file"
	                                                id={`${this.state.fields.uuid}_customProcuration`}
	                                                accept={acceptFileDocumentConvocation}
	                                                onChange={(e) => this.handleFileChange('customProcuration', e.target.files[0], acceptFileDocumentConvocation)}
	                                                style={{ display: 'none' }}/>
	                                        </InputFile>
	                                    </FormField>
	                                    {this.state.fields.customProcuration && (
	                                        <File attachment={{ filename: this.state.fields.customProcuration.name }} onDelete={() => this.deleteFile('customProcuration')} />
	                                    )}
	                                </Grid.Column>
	                            </Fragment>
	                        )}
	                        <Grid.Column mobile='16' computer='8'>
	                            <FormField htmlFor={`${this.state.fields.uuid}_file`}
	                                label={t('convocation.fields.convocation_document')} required={true}>
	                                <InputValidation id={`${this.state.fields.uuid}_file`}
	                                    labelClassName="primary"
	                                    type='file'
	                                    ariaRequired={true}
	                                    accept={acceptFileDocumentConvocation}
	                                    onChange={(file, accept) => this.handleFileChange('file', file, accept)}
	                                    value={this.state.fields.file}
	                                    label={`${t('api-gateway:form.add_a_file')}`}
	                                    fieldName={t('convocation.fields._file')} />
	                            </FormField>
	                            {this.state.fields.file && (
	                                <File attachment={{ filename: this.state.fields.file.name }} onDelete={() => this.deleteFile('file')} />
	                            )}
	                        </Grid.Column>
	                        <Grid.Column mobile='16' computer='8'>
	                            <FormField htmlFor={`${this.state.fields.uuid}_annexes`}
	                                label={t('convocation.fields.annexes')}>
	                                <InputFile labelClassName="primary" htmlFor={`${this.state.fields.uuid}_annexes`}
	                                    label={`${t('api-gateway:form.add_a_file')}`}>
	                                    <input type="file"
	                                        id={`${this.state.fields.uuid}_annexes`}
	                                        accept={acceptFileDocumentConvocation}
	                                        multiple
	                                        onChange={(e) => this.handleAnnexeChange(e.target.files, acceptFileDocumentConvocation)}
	                                        style={{ display: 'none' }}/>
	                                </InputFile>
	                            </FormField>
	                            {this.state.fields.annexes.length > 0 && (
	                                <div>
	                                    {annexes}
	                                    {this.state.fields.annexes.length > 3 && (
	                                        <div className='mt-15'>
	                                            <Button onClick={() => this.setState({showAllAnnexes: !this.state.showAllAnnexes})} className="link" primary compact basic>
	                                                {this.state.showAllAnnexes && (
	                                                    <span>{t('convocation.new.show_less_annexes')}</span>
	                                                )}
	                                                {!this.state.showAllAnnexes && (
	                                                    <span>{t('convocation.new.show_all_annexes', {number: this.state.fields.annexes.length})}</span>
	                                                )}
	                                            </Button>
	                                        </div>
	                                    )}

	                                </div>
	                            )}
	                        </Grid.Column>
	                    </Grid>
	                </Segment>
	                {/* Recipients */}
	                <AddRecipientsGuestsFormFragment epci={this.state.localAuthority.epci} fields={this.state.fields} updateUser={this.updateUser} disabledRecipientsEdit={!this.state.fields.assemblyType}/>
	                <div className='footerForm'>
	                    <Button type="button" style={{ marginRight: '1em' }} onClick={e => this.goBack()} basic color='red'>
	                        {t('api-gateway:form.cancel')}
	                    </Button>

	                    {this.state.allFormErrors.length > 0 &&
                            <ValidationPopup errorList={this.state.allFormErrors}>
                                {submissionButton}
                            </ValidationPopup>
	                    }
	                    {this.state.allFormErrors.length === 0 && submissionButton}
	                </div>
	            </Form>
	        </Page>
	    )
	}
}

export default translate(['convocation', 'api-gateway'])(withAuthContext(ConvocationForm))