import React, { Component } from 'react'
import { Menu, Dropdown, Container } from 'semantic-ui-react'

class TopBar extends Component {
    render() {
        return (
            <Menu className='topBar' fixed='top' secondary>
                <Container>
                    <Menu.Menu position='right'>
                        <Dropdown item text='John Doe'>
                            <Dropdown.Menu>
                                <Dropdown.Item>Paramètres</Dropdown.Item>
                                <Dropdown.Item>Déconnexion</Dropdown.Item>
                            </Dropdown.Menu>
                        </Dropdown>
                    </Menu.Menu>
                </Container>
            </Menu>
        )
    }
}

export default TopBar