import React, { Component } from 'react'
import PropTypes from 'prop-types'
import { translate } from 'react-i18next'
import { Segment, Icon, Input } from 'semantic-ui-react'

import { Page, Field, FieldValue, MigrationSteps } from '../../_components/UI'
import { notifications } from '../../_util/Notifications'
import { checkStatus, fetchWithAuthzHandling } from '../../_util/utils'

class PesLocalAuthorityMigration extends Component {
    static contextTypes = {
        csrfToken: PropTypes.string,
        csrfTokenHeaderName: PropTypes.string,
        t: PropTypes.func,
        _addNotification: PropTypes.func
    }
    static defaultProps = {
        uuid: ''
    }
    state = {
        fields: {
            uuid: '',
            name: '',
            siren: '',
            migrationStatus: ''
        },
        form: {
            email: '',
            siren: ''
        },
        status: 'init'
    }
    componentDidMount() {
        const uuid = this.props.uuid
        const url = uuid ? '/api/pes/localAuthority' + uuid : '/api/pes/localAuthority/current'
        fetchWithAuthzHandling({ url })
            .then(checkStatus)
            .then(response => response.json())
            .then(json => this.setState({ fields: json }))
            .catch(response => {
                response.json().then(json => {
                    this.context._addNotification(notifications.defaultError, 'notifications.admin.title', json.message)
                })
            })
    }
    onFormChange = (e, { id, value }) => {
        const { form } = this.state
        form[id] = value
        this.setState({ form })
    }
    getFormData = () => {
        const data = {}
        Object.keys(this.state.form)
            .filter(k => this.state.form[k] !== '')
            .map(k => data[k] = this.state.form[k])
        return data
    }
    migrate = () => {
        const url = `/api/pes/localAuthority/${this.props.uuid || 'current'}/migration`
        const data = this.getFormData()
        fetchWithAuthzHandling({ url, method: 'POST', query: data, context: this.context })
            .then(checkStatus)
            .then(() => {
                const { fields } = this.state
                fields.migrationStatus = 'ONGOING'
                this.setState({ fields })
            })
            .catch(response => {
                response.json().then(json => {
                    this.context._addNotification(notifications.defaultError, 'notifications.admin.title', json.message)
                })
            })
    }
    render() {
        const { t } = this.context
        const status = this.state.fields.migrationStatus || 'NOT_DONE'
        return (
            <Page title={t('admin.modules.pes.migration.title')}>
                <Segment>
                    <h2>{t('api-gateway:admin.local_authority.general_informations')}</h2>
                    <Field htmlFor="uuid" label={t('api-gateway:local_authority.uuid')}>
                        <FieldValue id="uuid">{this.state.fields.uuid}</FieldValue>
                    </Field>
                    <Field htmlFor="name" label={t('api-gateway:local_authority.name')}>
                        <FieldValue id="name">{this.state.fields.name}</FieldValue>
                    </Field>
                    <Field htmlFor="siren" label={t('api-gateway:local_authority.siren')}>
                        <FieldValue id="siren">{this.state.fields.siren}</FieldValue>
                    </Field>
                </Segment>

                <Segment>
                    <h2>{t('admin.modules.pes.migration.additional_options.title')}</h2>
                    <Field htmlFor='email' label={t('admin.modules.pes.migration.additional_options.email')}>
                        <Input id='email'
                            placeholder='Email...'
                            value={this.state.form.email}
                            onChange={this.onFormChange} />
                    </Field>
                    <Field htmlFor='siren' label={t('admin.modules.pes.migration.additional_options.siren')}>
                        <Input id='siren'
                            placeholder='SIREN...'
                            value={this.state.form.siren}
                            onChange={this.onFormChange} />
                    </Field>
                </Segment>
                <Segment>
                    <MigrationSteps
                        disabled
                        icon={<Icon name='users' />}
                        title={t('admin.modules.pes.migration.users_migration.title')}
                        description={t('admin.modules.pes.migration.users_migration.description')}
                        status='NOT_DONE'
                        onClick={this.migrate} />
                    <MigrationSteps
                        icon={<Icon name='calculator' />}
                        title={t('admin.modules.pes.migration.pes.title')}
                        description={t('admin.modules.pes.migration.pes.description')}
                        status={status}
                        onClick={this.migrate} />
                    <MigrationSteps
                        disabled
                        icon={<Icon.Group><Icon name='users' /><Icon corner name='delete' /> </Icon.Group>}
                        title={t('admin.modules.pes.migration.users_deactivation.title')}
                        description={t('admin.modules.pes.migration.users_deactivation.title')}
                        status='NOT_DONE'
                        onClick={this.migrate} />
                </Segment>
            </Page>
        )
    }
}

export default translate(['pes', 'api-gateway'])(PesLocalAuthorityMigration)