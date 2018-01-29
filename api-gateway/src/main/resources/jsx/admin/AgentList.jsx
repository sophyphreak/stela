import React, { Component } from 'react'
import PropTypes from 'prop-types'
import { translate } from 'react-i18next'
import { Segment, Dropdown } from 'semantic-ui-react'
import debounce from 'debounce'

import StelaTable from '../_components/StelaTable'
import { Page, Pagination } from '../_components/UI'
import { checkStatus, fetchWithAuthzHandling } from '../_util/utils'

class AgentList extends Component {
    static contextTypes = {
        t: PropTypes.func
    }
    state = {
        agents: [],
        totalCount: 0,
        limit: 25,
        offset: 0,
        column: '',
        direction: '',
        search: '',
        localAuthorities: [],
        selected: {}
    }
    componentDidMount() {
        this.fetchAgents()
        fetchWithAuthzHandling({ url: '/api/admin/local-authority/all' })
            .then(checkStatus)
            .then(response => response.json())
            .then(json => { this.setState({ localAuthorities: json }) })
    }
    handlePageClick = (data) => {
        const offset = Math.ceil(data.selected * this.state.limit)
        this.setState({ offset }, this.fetchAgents)
    }
    search = debounce((search) => {
        this.setState({ search }, this.fetchAgents)
    }, 500)
    fetchAgents = () => {
        const { limit, offset, column, direction, search } = this.state
        const params = { limit, offset, column, direction, search }
        if (this.state.selected.uuid) params.localAuthorityUuid = this.state.selected.uuid
        fetchWithAuthzHandling({ url: '/api/admin/agent/all', query: params })
            .then(checkStatus)
            .then(response => response.json())
            .then(json => this.setState({ agents: json.results, totalCount: json.totalCount }))
    }
    onSelectChange = (event, { value }) => {
        if (value === '') this.setState({ selected: '' }, this.fetchAgents)
        else {
            const selected = this.state.localAuthorities.find(localAuthority => localAuthority.uuid === value)
            this.setState({ selected }, this.fetchAgents)
        }
    }
    sort = (clickedColumn) => {
        const { column, direction } = this.state
        if (column !== clickedColumn) {
            this.setState({ column: clickedColumn, direction: 'ASC' }, this.fetchAgents)
            return
        }
        this.setState({ direction: direction === 'ASC' ? 'DESC' : 'ASC' }, this.fetchAgents)
    }
    render() {
        const { t } = this.context
        const metaData = [
            { property: 'uuid', displayed: false, searchable: false },
            { property: 'family_name', displayed: true, displayName: t('agent.family_name'), searchable: true, sortable: true },
            { property: 'given_name', displayed: true, displayName: t('agent.given_name'), searchable: true, sortable: true },
            { property: 'email', displayed: true, displayName: t('agent.email'), searchable: true, sortable: true },
        ]
        const displayedColumns = metaData.filter(metaData => metaData.displayed)
        const pageCount = Math.ceil(this.state.totalCount / this.state.limit)
        const localAuthoritiesOptions = [{ key: "0", value: "", text: t('admin.all_local_authorities') }]
        this.state.localAuthorities.map(localAuthority =>
            localAuthoritiesOptions.push({ key: localAuthority.uuid, value: localAuthority.uuid, text: localAuthority.name }))
        const selectLocalAuthorities =
            <Dropdown placeholder={t('admin.all_local_authorities')} search selection
                value={this.state.selected.uuid ? this.state.selected.uuid : ""}
                options={localAuthoritiesOptions}
                onChange={this.onSelectChange} />
        const pagination =
            <Pagination
                columns={displayedColumns.length}
                pageCount={pageCount}
                handlePageClick={this.handlePageClick} />
        return (
            <Page title={t('admin.users')}>
                <Segment>
                    <StelaTable
                        data={this.state.agents}
                        metaData={metaData}
                        header={true}
                        fetchedSearch={this.search}
                        noDataMessage='Aucun agent'
                        keyProperty='uuid'
                        pagination={pagination}
                        sort={this.sort}
                        direction={this.state.direction}
                        column={this.state.column}
                        additionalElements={[selectLocalAuthorities]} />
                </Segment>
            </Page>
        )
    }
}

export default translate(['api-gateway'])(AgentList)