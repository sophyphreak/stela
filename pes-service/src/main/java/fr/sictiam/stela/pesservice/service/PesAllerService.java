package fr.sictiam.stela.pesservice.service;

import com.fasterxml.jackson.databind.JsonNode;
import fr.sictiam.stela.pesservice.dao.AttachmentRepository;
import fr.sictiam.stela.pesservice.dao.PesAllerRepository;
import fr.sictiam.stela.pesservice.dao.PesExportRepository;
import fr.sictiam.stela.pesservice.dao.PesHistoryRepository;
import fr.sictiam.stela.pesservice.model.Attachment;
import fr.sictiam.stela.pesservice.model.LocalAuthority;
import fr.sictiam.stela.pesservice.model.PesAller;
import fr.sictiam.stela.pesservice.model.PesExport;
import fr.sictiam.stela.pesservice.model.PesHistory;
import fr.sictiam.stela.pesservice.model.PesHistoryError;
import fr.sictiam.stela.pesservice.model.StatusType;
import fr.sictiam.stela.pesservice.model.event.PesCreationEvent;
import fr.sictiam.stela.pesservice.model.event.PesHistoryEvent;
import fr.sictiam.stela.pesservice.service.exceptions.HistoryNotFoundException;
import fr.sictiam.stela.pesservice.service.exceptions.PesCreationException;
import fr.sictiam.stela.pesservice.service.exceptions.PesNotFoundException;
import fr.sictiam.stela.pesservice.service.exceptions.PesSendException;
import fr.sictiam.stela.pesservice.service.util.FTPUploaderService;
import org.apache.commons.lang3.StringUtils;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.context.ApplicationListener;
import org.springframework.core.env.Environment;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;
import org.w3c.dom.Document;
import org.xml.sax.SAXException;
import xyz.capybara.clamav.ClamavClient;
import xyz.capybara.clamav.ClamavException;
import xyz.capybara.clamav.commands.scan.result.ScanResult;
import xyz.capybara.clamav.commands.scan.result.ScanResult.OK;

import javax.annotation.PostConstruct;
import javax.persistence.EntityManager;
import javax.persistence.PersistenceContext;
import javax.persistence.TypedQuery;
import javax.persistence.criteria.CriteriaBuilder;
import javax.persistence.criteria.CriteriaQuery;
import javax.persistence.criteria.Join;
import javax.persistence.criteria.Predicate;
import javax.persistence.criteria.Root;
import javax.persistence.criteria.Subquery;
import javax.xml.parsers.DocumentBuilder;
import javax.xml.parsers.DocumentBuilderFactory;
import javax.xml.parsers.ParserConfigurationException;
import javax.xml.xpath.XPath;
import javax.xml.xpath.XPathExpressionException;
import javax.xml.xpath.XPathFactory;

import java.io.ByteArrayInputStream;
import java.io.IOException;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.ZonedDateTime;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.Formatter;
import java.util.List;
import java.util.Optional;


@Service
public class PesAllerService implements ApplicationListener<PesCreationEvent> {

    private static final Logger LOGGER = LoggerFactory.getLogger(PesAllerService.class);

    @PersistenceContext
    private EntityManager entityManager;

    private final PesAllerRepository pesAllerRepository;
    private final PesHistoryRepository pesHistoryRepository;
    private final AttachmentRepository attachmentRepository;
    private final ApplicationEventPublisher applicationEventPublisher;
    private final LocalAuthorityService localAuthorityService;
    private final FTPUploaderService ftpUploaderService;
    private final Environment environment;
    private final ExternalRestService externalRestService;
    private final PesExportRepository pesExportRepository;
    private final StorageService storageService;


    @Value("${application.clamav.port}")
    private Integer clamavPort;

    @Value("${application.clamav.host}")
    private String clamavHost;

    private ClamavClient clamavClient;

    @Autowired
    public PesAllerService(PesAllerRepository pesAllerRepository, PesHistoryRepository pesHistoryRepository,
            ApplicationEventPublisher applicationEventPublisher, LocalAuthorityService localAuthorityService,
            FTPUploaderService ftpUploaderService, Environment environment, StorageService storageService,
            AttachmentRepository attachmentRepository, ExternalRestService externalRestService,
            PesExportRepository pesExportRepository) {
        this.pesAllerRepository = pesAllerRepository;
        this.pesHistoryRepository = pesHistoryRepository;
        this.applicationEventPublisher = applicationEventPublisher;
        this.localAuthorityService = localAuthorityService;
        this.ftpUploaderService = ftpUploaderService;
        this.environment = environment;
        this.externalRestService = externalRestService;
        this.pesExportRepository = pesExportRepository;
        this.storageService = storageService;
        this.attachmentRepository = attachmentRepository;
    }

    @PostConstruct
    private void init() {
        clamavClient = new ClamavClient(clamavHost, clamavPort);
    }

    public Long countAllWithQuery(String multifield, String objet, LocalDate creationFrom, LocalDate creationTo,
            StatusType status, String currentLocalAuthUuid) {
        CriteriaBuilder builder = entityManager.getCriteriaBuilder();
        CriteriaQuery<Long> query = builder.createQuery(Long.class);
        Root<PesAller> pesRoot = query.from(PesAller.class);

        List<Predicate> predicates = getQueryPredicates(builder, pesRoot, multifield, objet, creationFrom, creationTo,
                status, currentLocalAuthUuid);
        query.select(builder.count(pesRoot));
        query.where(predicates.toArray(new Predicate[predicates.size()]));

        return entityManager.createQuery(query).getSingleResult();
    }

    public List<PesAller> getAllWithQuery(String multifield, String objet, LocalDate creationFrom, LocalDate creationTo,
            StatusType status, Integer limit, Integer offset, String column, String direction,
            String currentLocalAuthUuid) {
        CriteriaBuilder builder = entityManager.getCriteriaBuilder();
        CriteriaQuery<PesAller> query = builder.createQuery(PesAller.class);
        Root<PesAller> pesRoot = query.from(PesAller.class);

        query.select(builder.construct(PesAller.class, pesRoot.get("uuid"), pesRoot.get("creation"),
                pesRoot.get("objet"), pesRoot.get("fileType"), pesRoot.get("lastHistoryDate"),
                pesRoot.get("lastHistoryStatus")));

        String columnAttribute = StringUtils.isEmpty(column) ? "creation" : column;
        List<Predicate> predicates = getQueryPredicates(builder, pesRoot, multifield, objet, creationFrom, creationTo,
                status, currentLocalAuthUuid);

        query.where(predicates.toArray(new Predicate[predicates.size()]))
                .orderBy(!StringUtils.isEmpty(direction) && direction.equals("ASC")
                        ? builder.asc(pesRoot.get(columnAttribute))
                        : builder.desc(pesRoot.get(columnAttribute)));

        return entityManager.createQuery(query).setFirstResult(offset).setMaxResults(limit).getResultList();
    }

    private List<Predicate> getQueryPredicates(CriteriaBuilder builder, Root<PesAller> pesRoot, String multifield,
            String objet, LocalDate creationFrom, LocalDate creationTo, StatusType status,
            String currentLocalAuthUuid) {
        List<Predicate> predicates = new ArrayList<>();
        if (StringUtils.isNotBlank(multifield)) {
            predicates.add(
                    builder.or(builder.like(builder.lower(pesRoot.get("objet")), "%" + multifield.toLowerCase() + "%"),
                            builder.like(builder.lower(pesRoot.get("comment")), "%" + multifield.toLowerCase() + "%")));
        }
        if (StringUtils.isNotBlank(objet))
            predicates.add(
                    builder.and(builder.like(builder.lower(pesRoot.get("objet")), "%" + objet.toLowerCase() + "%")));
        if (StringUtils.isNotBlank(currentLocalAuthUuid)) {
            Join<LocalAuthority, PesAller> LocalAuthorityJoin = pesRoot.join("localAuthority");
            LocalAuthorityJoin.on(builder.equal(LocalAuthorityJoin.get("uuid"), currentLocalAuthUuid));
        }

        if (creationFrom != null && creationTo != null)
            predicates.add(builder.and(builder.between(pesRoot.get("creation"), creationFrom.atStartOfDay(),
                    creationTo.plusDays(1).atStartOfDay())));

        if (status != null) {
            predicates.add(builder.equal(pesRoot.get("lastHistoryStatus"), status));
        }

        return predicates;
    }

    public PesAller populateFromByte(PesAller pesAller, byte[] file) {

        try {
            DocumentBuilderFactory factory = DocumentBuilderFactory.newInstance();
            DocumentBuilder builder = factory.newDocumentBuilder();
            Document document = builder.parse(new ByteArrayInputStream(file));

            XPathFactory xpf = XPathFactory.newInstance();
            XPath path = xpf.newXPath();

            pesAller.setFileType(path.evaluate("/PES_Aller/Enveloppe/Parametres/TypFic/@V", document));
            pesAller.setFileName(path.evaluate("/PES_Aller/Enveloppe/Parametres/NomFic/@V", document));
            pesAller.setColCode(path.evaluate("/PES_Aller/EnTetePES/CodCol/@V", document));
            pesAller.setPostId(path.evaluate("/PES_Aller/EnTetePES/IdPost/@V", document));
            pesAller.setBudCode(path.evaluate("/PES_Aller/EnTetePES/CodBud/@V", document));

        } catch (IOException | XPathExpressionException | ParserConfigurationException | SAXException e) {
            throw new PesCreationException();
        }
        return pesAller;

    }

    public PesAller create(String currentProfileUuid, String currentLocalAuthUuid, PesAller pesAller,
            String filename, byte[] content) throws PesCreationException {

        pesAller.setLocalAuthority(localAuthorityService.getByUuid(currentLocalAuthUuid));
        pesAller.setProfileUuid(currentProfileUuid);

        Attachment attachment = new Attachment(filename, content, content.length, LocalDateTime.now());

        pesAller.setAttachment(attachment);
        pesAller.setCreation(LocalDateTime.now());

        populateFromByte(pesAller, content);

        if (getByFileName(pesAller.getFileName()).isPresent()) {
            throw new PesCreationException("notifications.pes.sent.error.existing_file_name", null);
        }

        pesAller = pesAllerRepository.saveAndFlush(pesAller);
        updateStatus(pesAller.getUuid(), StatusType.CREATION_IN_PROGRESS);
        // trigger event to store attachment
        applicationEventPublisher.publishEvent(new PesCreationEvent(this, pesAller));

        return pesAller;
    }

    public PesAller create(String currentProfileUuid, String currentLocalAuthUuid, PesAller pesAller,
            MultipartFile file) throws PesCreationException {

        try {
            return create(currentProfileUuid, currentLocalAuthUuid, pesAller, file.getOriginalFilename(), file.getBytes());
        } catch (IOException e) {
            LOGGER.error("Failed to read file content : {}", e.getMessage());
            throw new PesCreationException("Failed to read file content", e);
        }
    }


    public PesAller getByUuid(String uuid) {
        return pesAllerRepository.findById(uuid).orElseThrow(PesNotFoundException::new);
    }

    List<PesAller.Light> getPendingSinature() {
        return pesAllerRepository.findByPjFalseAndSignedFalseAndLocalAuthoritySesileSubscriptionTrueAndArchiveNull();
    }

    public void updateStatus(String pesUuid, StatusType updatedStatus) {
        PesHistory pesHistory = new PesHistory(pesUuid, updatedStatus);
        updateHistory(pesHistory);
        applicationEventPublisher.publishEvent(new PesHistoryEvent(this, pesHistory));
    }

    public void updateStatus(String pesUuid, StatusType updatedStatus, String message) {
        PesHistory pesHistory = new PesHistory(pesUuid, updatedStatus, LocalDateTime.now(), message);
        updateHistory(pesHistory);
        applicationEventPublisher.publishEvent(new PesHistoryEvent(this, pesHistory));
    }

    public void updateStatus(String pesUuid, StatusType updatedStatus, byte[] file, String fileName) {
        updateStatus(pesUuid, updatedStatus, file, fileName, null);
    }

    public void updateStatus(String pesUuid, StatusType updatedStatus, byte[] file, String
            fileName, List<PesHistoryError> errors) {
        Attachment attachment = storageService.createAttachment(fileName, file);
        PesHistory pesHistory = new PesHistory(pesUuid, updatedStatus, LocalDateTime.now(), attachment, errors);
        updateHistory(pesHistory);
        applicationEventPublisher.publishEvent(new PesHistoryEvent(this, pesHistory));
    }

    public void updateHistory(PesHistory newPesHistory) {
        PesAller pes = getByUuid(newPesHistory.getPesUuid());

        if (newPesHistory.getStatus() != StatusType.NOTIFICATION_SENT && newPesHistory.getStatus() != StatusType.GROUP_NOTIFICATION_SENT) {
            // do not update last history Pes fields on status NOTIFICATION_SENT|GROUP_NOTIFICATION_SENT
            pes.setLastHistoryDate(newPesHistory.getDate());
            pes.setLastHistoryStatus(newPesHistory.getStatus());
        }
        pes.getPesHistories().add(newPesHistory);
        pesAllerRepository.saveAndFlush(pes);
    }

    public boolean checkVirus(byte[] file) throws ClamavException, IOException {
        ScanResult mainResult = clamavClient.scan(new ByteArrayInputStream(file));
        boolean status = false;
        if (!mainResult.equals(OK.INSTANCE)) {
            status = true;
        }
        return status;
    }

    public PesAller save(PesAller pes) {
        return pesAllerRepository.saveAndFlush(pes);
    }

    public Optional<PesAller> getByFileName(String fileName) {
        return pesAllerRepository.findByFileName(fileName);
    }

    public List<String> getBlockedFlux() {

        CriteriaBuilder cb = entityManager.getCriteriaBuilder();
        CriteriaQuery<String> query = cb.createQuery(String.class);
        Root<PesAller> pesTable = query.from(PesAller.class);
        query.select(pesTable.get("uuid"));

        Subquery<PesHistory> subquery = query.subquery(PesHistory.class);
        Root<PesHistory> historyTable = subquery.from(PesHistory.class);
        subquery
                .select(historyTable.get("pesUuid")).distinct(true)
                .where(historyTable.get("status")
                        .in(Arrays.asList(StatusType.MAX_RETRY_REACH, StatusType.ACK_RECEIVED, StatusType.NACK_RECEIVED)));

        Subquery<PesHistory> subquery2 = query.subquery(PesHistory.class);
        Root<PesHistory> historyTable2 = subquery2.from(PesHistory.class);
        subquery2
                .select(historyTable2.get("pesUuid")).distinct(true)
                .where(historyTable2.get("status")
                        .in(Arrays.asList(StatusType.SENT, StatusType.RESENT, StatusType.MANUAL_RESENT)));

        List<Predicate> mainQueryPredicates = new ArrayList<>();
        mainQueryPredicates.add(cb.not(pesTable.get("uuid").in(subquery)));
        mainQueryPredicates.add(pesTable.get("uuid").in(subquery2));
        mainQueryPredicates.add(cb.equal(pesTable.get("imported"), false));

        query.where(mainQueryPredicates.toArray(new Predicate[]{}));
        TypedQuery<String> typedQuery = entityManager.createQuery(query);
        List<String> resultList = typedQuery.getResultList();

        return resultList;
    }

    public List<PesHistory> getPesHistoryByTypes(String uuid, List<StatusType> statusTypes) {
        return pesHistoryRepository.findBypesUuidAndStatusInOrderByDateDesc(uuid, statusTypes);
    }

    public PesHistory getLastSentHistory(String uuid) {
        return pesHistoryRepository
                .findBypesUuidAndStatusInOrderByDateDesc(uuid, Arrays.asList(StatusType.SENT, StatusType.RESENT))
                .get(0);
    }

    public PesHistory getHistoryByUuid(String uuid) {
        return pesHistoryRepository.findByUuid(uuid).orElseThrow(HistoryNotFoundException::new);
    }

    private String getSha1FromBytes(byte[] bytes) {
        try {
            MessageDigest md = MessageDigest.getInstance("SHA-1");
            Formatter formatter = new Formatter();
            for (byte b : md.digest(bytes)) formatter.format("%02x", b);
            return formatter.toString();
        } catch (NoSuchAlgorithmException e) {
            LOGGER.error("Error while trying to get sha1 from file: {}", e.getMessage());
            return null;
        }
    }

    private void persistPesExport(PesAller pes) {
        PesExport pesExport = new PesExport(pes.getUuid(), ZonedDateTime.now(), pes.getAttachment().getFilename(),
                pes.getAttachment().getSize(), getSha1FromBytes(pes.getAttachment().getContent()), pes.getLocalAuthority().getSiren());
        try {
            JsonNode node = externalRestService.getProfile(pes.getProfileUuid());
            pesExport.setAgentFirstName(node.get("agent").get("given_name").asText());
            pesExport.setAgentName(node.get("agent").get("family_name").asText());
            pesExport.setAgentEmail(node.get("agent").get("email").asText());
        } catch (Exception e) {
            LOGGER.error("Error while retrieving profile infos : {}", e.getMessage());
        }
        pesExportRepository.save(pesExport);
    }

    public void manualResend(String pesUuid) {
        PesAller pes = getByUuid(pesUuid);
        send(pes);
        StatusType statusType = StatusType.MANUAL_RESENT;
        updateStatus(pes.getUuid(), statusType);
    }

    public void manualRepublish(String pesUuid) {
        PesAller pes = getByUuid(pesUuid);
        updateStatus(pes.getUuid(), StatusType.RECREATED);
    }

    public void send(PesAller pes) throws PesSendException {
        LOGGER.info("Sending PES {} ({})...", pes.getObjet(), pes.getUuid());
        try {
            ftpUploaderService.uploadFile(pes);
            persistPesExport(pes);
        } catch (IOException e) {
            LOGGER.error("Error sending PES on FTP: {}", e.getMessage());
            throw new PesSendException();
        }
    }

    public List<PesAller> getPesInError(String localAuthorityUuid) {
        int nbDays = Integer.parseInt(environment.getProperty("application.dailymail.retensiondays", "1"));
        return pesAllerRepository.findAllByLocalAuthority_UuidAndLastHistoryStatusAndLastHistoryDateGreaterThan(
                localAuthorityUuid, StatusType.NACK_RECEIVED, LocalDateTime.now().minusDays(nbDays));
    }

    @Override
    public void onApplicationEvent(PesCreationEvent event) {
        Attachment attachment = event.getPesAller().getAttachment();
        storageService.storeAttachment(attachment);
        updateStatus(event.getPesAller().getUuid(), StatusType.CREATED);
    }
}
