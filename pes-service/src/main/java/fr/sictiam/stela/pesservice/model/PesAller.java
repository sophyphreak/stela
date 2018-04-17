package fr.sictiam.stela.pesservice.model;

import com.fasterxml.jackson.databind.annotation.JsonDeserialize;
import fr.sictiam.stela.pesservice.config.LocalDateDeserializer;
import org.hibernate.annotations.GenericGenerator;

import javax.persistence.*;
import javax.validation.constraints.NotNull;
import javax.validation.constraints.Size;

import java.time.LocalDateTime;
import java.util.SortedSet;

@Entity
public class PesAller {

    public interface RestValidation {
        // validation group marker interface
    }

    @Id
    @GeneratedValue(generator = "UUID")
    @GenericGenerator(name = "UUID", strategy = "org.hibernate.id.UUIDGenerator")
    private String uuid;

    @JsonDeserialize(using = LocalDateDeserializer.class)
    private LocalDateTime creation;

    @Column(length = 512)
    @NotNull(groups = { RestValidation.class })
    @Size(max = 500, groups = { RestValidation.class })
    private String objet;

    @OneToOne(cascade = CascadeType.ALL, fetch = FetchType.EAGER)
    private Attachment attachment;

    @OneToMany(cascade = CascadeType.ALL, fetch = FetchType.EAGER)
    @OrderBy("date ASC")
    private SortedSet<PesHistory> pesHistories;

    @ManyToOne
    private LocalAuthority localAuthority;

    private String profileUuid;

    @Size(max = 250, groups = { RestValidation.class })
    private String comment;

    private String fileType;
    private String colCode;
    private String postId;
    private String budCode;
    private String fileName;

    private boolean pj;

    private boolean signed;

    private Integer sesileClasseurId;

    private Integer sesileDocumentId;

    private Integer daysToValidated;

    private Integer serviceOrganisationNumber;

    public PesAller() {
    }

    public String getUuid() {
        return this.uuid;
    }

    public String getObjet() {
        return objet;
    }

    public void setObjet(String objet) {
        this.objet = objet;
    }

    public LocalDateTime getCreation() {
        return creation;
    }

    public void setCreation(LocalDateTime creation) {
        this.creation = creation;
    }

    public SortedSet<PesHistory> getPesHistories() {
        return pesHistories;
    }

    public void setPesHistories(SortedSet<PesHistory> pesHistories) {
        this.pesHistories = pesHistories;
    }

    public LocalAuthority getLocalAuthority() {
        return localAuthority;
    }

    public void setLocalAuthority(LocalAuthority localAuthority) {
        this.localAuthority = localAuthority;
    }

    public String getProfileUuid() {
        return profileUuid;
    }

    public void setProfileUuid(String profileUuid) {
        this.profileUuid = profileUuid;
    }

    public Attachment getAttachment() {
        return attachment;
    }

    public void setAttachment(Attachment attachment) {
        this.attachment = attachment;
    }

    public String getComment() {
        return comment;
    }

    public void setComment(String comment) {
        this.comment = comment;
    }

    public String getFileType() {
        return fileType;
    }

    public void setFileType(String fileType) {
        this.fileType = fileType;
    }

    public String getColCode() {
        return colCode;
    }

    public void setColCode(String colCode) {
        this.colCode = colCode;
    }

    public String getPostId() {
        return postId;
    }

    public void setPostId(String postId) {
        this.postId = postId;
    }

    public String getBudCode() {
        return budCode;
    }

    public void setBudCode(String budCode) {
        this.budCode = budCode;
    }

    public String getFileName() {
        return fileName;
    }

    public void setFileName(String fileName) {
        this.fileName = fileName;
    }

    public boolean isPj() {
        return pj;
    }

    public void setPj(boolean pj) {
        this.pj = pj;
    }

    public boolean isSigned() {
        return signed;
    }

    public Integer getSesileClasseurId() {
        return sesileClasseurId;
    }

    public void setSesileClasseurId(Integer sesileClasseurId) {
        this.sesileClasseurId = sesileClasseurId;
    }

    public void setSigned(boolean signed) {
        this.signed = signed;
    }

    public Integer getSesileDocumentId() {
        return sesileDocumentId;
    }

    public Integer getDaysToValidated() {
        return daysToValidated;
    }

    public void setDaysToValidated(Integer daysToValidated) {
        this.daysToValidated = daysToValidated;
    }

    public Integer getServiceOrganisationNumber() {
        return serviceOrganisationNumber;
    }

    public void setServiceOrganisationNumber(Integer serviceOrganisationNumber) {
        this.serviceOrganisationNumber = serviceOrganisationNumber;
    }

    public void setSesileDocumentId(Integer sesileDocumentId) {
        this.sesileDocumentId = sesileDocumentId;
    }
}
