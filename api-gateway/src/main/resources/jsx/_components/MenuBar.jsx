import React, { Component } from 'react'
import PropTypes from 'prop-types'
import { NavLink } from 'react-router-dom'
import { Menu, Icon } from 'semantic-ui-react'
import { translate } from 'react-i18next'

import { fetchWithAuthzHandling, getRightsFromGroups, rightsFeatureResolver, rightsModuleResolver } from '../_util/utils'

class MenuBar extends Component {
    static contextTypes = {
        isLoggedIn: PropTypes.bool,
        t: PropTypes.func
    }
    state = {
        profile: {
            uuid: '',
            localAuthority: {
                activatedModules: []
            },
            groups: []
        }
    }
    componentDidMount() {
        fetchWithAuthzHandling({ url: '/api/admin/profile' })
            .then(response => response.json())
            .then(profile => this.setState({ profile }, this.fetchAllRights))
    }
    render() {
        const { isLoggedIn, t } = this.context
        const rights = getRightsFromGroups(this.state.profile.groups)
        return (
            <Menu style={{ backgroundColor: 'white' }} className='mainMenu anatra' fixed='left' secondary vertical >

                <div className='mainMenus'>
                    {(isLoggedIn && rightsModuleResolver(rights, 'ACTES')) &&
                        < Menu.Item style={{ width: '100%' }}>
                            <Icon name='checkmark box' size='large' />
                            <Menu.Header>{t('menu.acte.legality_control')}</Menu.Header>
                            <Menu.Menu>
                                {rightsFeatureResolver(rights, ['ACTES_DEPOSIT']) &&
                                    < Menu.Item as={NavLink} to="/actes/nouveau">{t('menu.acte.submit_an_act')}</Menu.Item>
                                }
                                {rightsFeatureResolver(rights, ['ACTES_DEPOSIT', 'ACTES_DISPLAY']) &&
                                    <Menu.Item as={NavLink} to="/actes/liste">{t('menu.acte.list')}</Menu.Item>
                                }
                                {rightsFeatureResolver(rights, ['ACTES_DEPOSIT']) &&
                                    <Menu.Item as={NavLink} to="/actes/brouillons">{t('menu.acte.drafts')}</Menu.Item>
                                }
                            </Menu.Menu>
                        </Menu.Item>
                    }

                    {(isLoggedIn && rightsModuleResolver(rights, 'PES')) &&
                        <Menu.Item style={{ width: '100%' }}>
                            <Icon name='calculator' size='large' />
                            <Menu.Header>{t('menu.pes.accounting_flow')}</Menu.Header>
                            <Menu.Menu>
                                {rightsFeatureResolver(rights, ['PES_DEPOSIT']) &&
                                    <Menu.Item as={NavLink} to="/pes/nouveau">{t('menu.pes.submit_a_PES_Aller')}</Menu.Item>
                                }
                                {rightsFeatureResolver(rights, ['PES_DEPOSIT', 'PES_DISPLAY']) &&
                                    <Menu.Item as={NavLink} to="/pes/liste">{t('menu.pes.PES_Aller_list')}</Menu.Item>
                                }
                                {rightsFeatureResolver(rights, ['PES_DEPOSIT', 'PES_DISPLAY']) &&
                                    <Menu.Item as={NavLink} to="/pes/retour/liste">{t('menu.pes.PES_Retour_list')}</Menu.Item>
                                }
                            </Menu.Menu>
                        </Menu.Item>
                    }

                    {(isLoggedIn && rightsModuleResolver(rights, 'CONVOCATION')) &&
                        <Menu.Item style={{ width: '100%' }}>
                            <Icon name='calendar outline' size='large' />
                            <Menu.Header>{t('menu.convocation.convocation')}</Menu.Header>
                            <Menu.Menu>
                                <Menu.Item>{t('menu.convocation.send_a_convocation')}</Menu.Item>
                                <Menu.Item>{t('menu.convocation.reveived_convocations')}</Menu.Item>
                                <Menu.Item>{t('menu.convocation.sent_convocations')}</Menu.Item>
                            </Menu.Menu>
                        </Menu.Item>
                    }

                    <Menu.Item style={{ width: '100%' }}>
                        <Icon name='help' size='large' />
                        <Menu.Header>{t('menu.informations.title')}</Menu.Header>
                        <Menu.Menu>
                            <Menu.Item>{t('menu.informations.contact')}</Menu.Item>
                            <Menu.Item as={NavLink} to="/mentions-legales">{t('menu.informations.legal_notice')}</Menu.Item>
                        </Menu.Menu>
                    </Menu.Item>
                </div>

                <div>
                    <Menu.Item style={{ width: '100%' }} >
                        <img style={{ width: '100%', padding: '2em' }} src={process.env.PUBLIC_URL + '/img/logo_sictiam.jpg'} alt="SICTIAM" />
                    </Menu.Item>

                    <Menu.Item style={{ textAlign: 'center', width: '100%' }}>
                        {t('made_with_love')}
                    </Menu.Item>
                </div>

            </Menu >
        )
    }
}

export default translate(['api-gateway'])(MenuBar)