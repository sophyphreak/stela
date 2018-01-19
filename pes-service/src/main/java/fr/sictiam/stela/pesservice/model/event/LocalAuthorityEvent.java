package fr.sictiam.stela.pesservice.model.event;

import java.util.Set;

import fr.sictiam.stela.pesservice.model.LocalAuthority;

public class LocalAuthorityEvent extends Event {

    private String uuid;
    private String name;
    private String siren;

    private Set<Module> activatedModules;
        
    public LocalAuthorityEvent() {
        super(LocalAuthorityEvent.class.getName());
    }
    
    public LocalAuthorityEvent(LocalAuthority localAuthority) {
        super(LocalAuthorityEvent.class.getName());
        this.uuid = localAuthority.getUuid();
        this.name = localAuthority.getName();
        this.siren = localAuthority.getSiren();
    }

    public String getUuid() {
        return uuid;
    }

    public void setUuid(String uuid) {
        this.uuid = uuid;
    }

    public String getName() {
        return name;
    }

    public void setName(String name) {
        this.name = name;
    }

    public String getSiren() {
        return siren;
    }

    public void setSiren(String siren) {
        this.siren = siren;
    }
    
    public Set<Module> getActivatedModules() {
        return activatedModules;
    }

    public void setActivatedModules(Set<Module> activatedModules) {
        this.activatedModules = activatedModules;
    }    
    
}
