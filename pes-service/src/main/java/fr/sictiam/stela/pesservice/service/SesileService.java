package fr.sictiam.stela.pesservice.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.github.andrewoma.dexx.collection.Pair;
import fr.sictiam.signature.pes.producer.SigningPolicies.SigningPolicy1;
import fr.sictiam.signature.pes.verifier.CertificateProcessor.CertificatInformation1;
import fr.sictiam.signature.pes.verifier.InvalidPesAllerFileException;
import fr.sictiam.signature.pes.verifier.PesAllerAnalyser;
import fr.sictiam.signature.pes.verifier.SignatureValidation;
import fr.sictiam.signature.pes.verifier.SignatureValidationError;
import fr.sictiam.signature.pes.verifier.SignatureVerifierResult;
import fr.sictiam.signature.pes.verifier.SimplePesInformation;
import fr.sictiam.signature.pes.verifier.XMLDsigSignatureAndReferencesProcessor.XMLDsigReference1;
import fr.sictiam.signature.pes.verifier.XadesInfoProcessor.XadesInfoProcessResult1;
import fr.sictiam.signature.utils.DateUtils;
import fr.sictiam.stela.pesservice.dao.GenericDocumentRepository;
import fr.sictiam.stela.pesservice.dao.SesileConfigurationRepository;
import fr.sictiam.stela.pesservice.model.GenericDocument;
import fr.sictiam.stela.pesservice.model.LocalAuthority;
import fr.sictiam.stela.pesservice.model.PesAller;
import fr.sictiam.stela.pesservice.model.SesileConfiguration;
import fr.sictiam.stela.pesservice.model.StatusType;
import fr.sictiam.stela.pesservice.model.event.PesHistoryEvent;
import fr.sictiam.stela.pesservice.model.sesile.Classeur;
import fr.sictiam.stela.pesservice.model.sesile.ClasseurRequest;
import fr.sictiam.stela.pesservice.model.sesile.ClasseurType;
import fr.sictiam.stela.pesservice.model.sesile.Document;
import fr.sictiam.stela.pesservice.model.sesile.ServiceOrganisation;
import org.apache.commons.lang3.StringUtils;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.ApplicationListener;
import org.springframework.core.io.ByteArrayResource;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpMethod;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Service;
import org.springframework.util.LinkedMultiValueMap;
import org.springframework.util.MultiValueMap;
import org.springframework.web.client.RestClientException;
import org.springframework.web.client.RestTemplate;
import org.w3c.dom.Element;

import javax.validation.constraints.NotNull;

import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.io.UnsupportedEncodingException;
import java.text.SimpleDateFormat;
import java.time.LocalDate;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.Date;
import java.util.List;
import java.util.Optional;
import java.util.stream.Collectors;

@Service
public class SesileService implements ApplicationListener<PesHistoryEvent> {

    private static final Logger LOGGER = LoggerFactory.getLogger(SesileService.class);

    private final PesAllerService pesService;

    private RestTemplate restTemplate = new RestTemplate();

    @Value("${application.sesile.apiUrl}")
    String sesileUrl;

    private final ExternalRestService externalRestService;

    private final SesileConfigurationRepository sesileConfigurationRepository;

    private final GenericDocumentRepository genericDocumentRepository;

    private final LocalesService localesService;

    public SesileService(PesAllerService pesService, ExternalRestService externalRestService,
            SesileConfigurationRepository sesileConfigurationRepository, LocalesService localesService,
            GenericDocumentRepository genericDocumentRepository) {
        this.pesService = pesService;
        this.externalRestService = externalRestService;
        this.sesileConfigurationRepository = sesileConfigurationRepository;
        this.localesService = localesService;
        this.genericDocumentRepository = genericDocumentRepository;
    }

    public SesileConfiguration createOrUpdate(SesileConfiguration sesileConfiguration) {
        return sesileConfigurationRepository.save(sesileConfiguration);
    }

    public SesileConfiguration getConfigurationByUuid(String uuid) {
        return sesileConfigurationRepository.findById(uuid).orElseGet(SesileConfiguration::new);
    }

    public void submitToSignature(PesAller pes) {

        try {
            SesileConfiguration sesileConfiguration = sesileConfigurationRepository.findById(pes.getProfileUuid())
                    .orElse(sesileConfigurationRepository.findById(pes.getLocalAuthority().getGenericProfileUuid())
                            .get());
            JsonNode profile = externalRestService.getProfile(pes.getProfileUuid());

            LocalDate deadline = pes.getValidationLimit() != null ? pes.getValidationLimit()
                    : LocalDate.now().plusDays(sesileConfiguration.getDaysToValidated());
            DateTimeFormatter dateTimeFormatter = DateTimeFormatter.ofPattern("dd/MM/yyyy");

            ResponseEntity<Classeur> classeur = postClasseur(pes.getLocalAuthority(),
                    new ClasseurRequest(pes.getObjet(), StringUtils.defaultString(pes.getComment()),
                            deadline.format(dateTimeFormatter), sesileConfiguration.getType(),
                            pes.getServiceOrganisationNumber() != null ? pes.getServiceOrganisationNumber()
                                    : sesileConfiguration.getServiceOrganisationNumber(),
                            sesileConfiguration.getVisibility(), profile.get("agent").get("email").asText()));

            Document document = addFileToclasseur(pes.getLocalAuthority(), pes.getAttachment().getFile(),
                    pes.getAttachment().getFilename(), classeur.getBody().getId()).getBody();

            pes.setSesileClasseurId(classeur.getBody().getId());
            pes.setSesileDocumentId(document.getId());
            pesService.save(pes);
            pesService.updateStatus(pes.getUuid(), StatusType.PENDING_SIGNATURE);
        } catch (Exception e) {
            LOGGER.error(e.getMessage());
            pesService.updateStatus(pes.getUuid(), StatusType.SIGNATURE_SENDING_ERROR);
        }
    }

    public void checkPesSigned() {
        List<PesAller> pesAllers = pesService.getPendingSinature();
        pesAllers.forEach(pes -> {

            if (pes.getSesileDocumentId() != null
                    && checkDocumentSigned(pes.getLocalAuthority(), pes.getSesileDocumentId())) {

                try {
                    byte[] file = getDocumentBody(pes.getLocalAuthority(), pes.getSesileDocumentId());
                    Pair<StatusType, String> signatureResult = getSignatureStatus(file);
                    StatusType status = signatureResult.component1();
                    String errorMessage = signatureResult.component2();
                    pes.setSigned(status.equals(StatusType.PENDING_SEND));
                    pes.getAttachment().setFile(file);

                    pesService.save(pes);
                    pesService.updateStatus(pes.getUuid(), status, errorMessage);

                } catch (RestClientException | UnsupportedEncodingException e) {
                    LOGGER.debug(e.getMessage());
                }

            }
        });
    }

    public SimplePesInformation computeSimplePesInformation(byte[] file) {
        ByteArrayInputStream bais = new ByteArrayInputStream(file);
        ByteArrayOutputStream stream = new ByteArrayOutputStream();
        PesAllerAnalyser pesAllerAnalyser = new PesAllerAnalyser(bais, stream);

        pesAllerAnalyser.setDoSchemaValidation(true);
        try {
            pesAllerAnalyser.computeSimpleInformation();
        } catch (InvalidPesAllerFileException e) {
            LOGGER.error(e.getMessage());
        }
        return pesAllerAnalyser.getSimplePesInformation();
    }

    public boolean isSigned(SimplePesInformation simplePesInformation) {
        return simplePesInformation.isSigned();
    }

    public SignatureValidation isValidSignature(SimplePesInformation simplePesInformation) {
        PesAllerAnalyser pesAllerAnalyser = new PesAllerAnalyser(simplePesInformation);
        try {
            pesAllerAnalyser.computeSignaturesVerificationResults();
        } catch (InvalidPesAllerFileException e) {
            LOGGER.error(e.getMessage());
        }
        pesAllerAnalyser.computeSignaturesTypeVerification();

        SignatureValidation signatureValidation = new SignatureValidation();
        List<SignatureValidationError> signatureValidationErrors = new ArrayList<>();
        signatureValidation.setSignatureValidationErrors(signatureValidationErrors);
        signatureValidation.setValid(true);
        if ((pesAllerAnalyser.isDoSchemaValidation()) && (!pesAllerAnalyser.isSchemaOK())) {
            signatureValidation.setValid(false);
            signatureValidation.getSignatureValidationErrors().add(SignatureValidationError.INVALID_SCHEMA);
        }
        if (!signatureValidation.isValid()) {
            return signatureValidation;
        }

        for (Element element : simplePesInformation.getSignatureElements()) {
            SignatureVerifierResult verificationResult = pesAllerAnalyser.getSignaturesVerificationResults()
                    .get(element);
            if ((!verificationResult.isSignatureGlobalePresente())
                    && (verificationResult.getListeBordereauxNonSignes() != null)) {
                signatureValidation.getSignatureValidationErrors().add(SignatureValidationError.NOT_SIGNED_CONTENT);
            }
            if (verificationResult.getUnverifiableSignatureException() != null) {
                signatureValidationErrors.add(SignatureValidationError.UNVERIFIABLE_SIGNATURE);
            } else {

                XadesInfoProcessResult1 xadesInfoProcessResult = verificationResult.getXadesInfoProcessResult();
                List<XMLDsigReference1> listRef = verificationResult.getSignatureAndRefsVerificationResult()
                        .getReferencesInfo();

                boolean isSomeSignedPropertyReference = false;
                for (XMLDsigReference1 ref : listRef) {
                    if (ref.isSignedPropertiesReferenceLookup(simplePesInformation.getPesDocument())) {
                        isSomeSignedPropertyReference = true;
                    }
                }

                boolean signatureVerifiedOk = verificationResult.getSignatureAndRefsVerificationResult()
                        .isSignatureVerified();

                boolean certificatProcessOk = verificationResult.getCertificateProcessException() == null;
                boolean certificatHashOk = (xadesInfoProcessResult.getSigCertExpectedHash() == null)
                        || (xadesInfoProcessResult.getSigCertExpectedHash()
                                .equals(xadesInfoProcessResult.getSigCertcalculatedHash()));

                boolean mainC14Ok = verificationResult.getSignatureAndRefsVerificationResult().isMainC14Accepted();
                boolean allrefsC14Ok = verificationResult.getSignatureAndRefsVerificationResult()
                        .isAllrefsC14Accepted();

                boolean certificateConfianceOk = false;
                CertificatInformation1 certificatInformation = null;
                if (certificatProcessOk) {
                    certificatInformation = verificationResult.getCertificatInformation();
                    certificateConfianceOk = (certificatInformation.getValidatedCertPath() != null)
                            && (!certificatInformation.getValidatedCertPath().isEmpty());
                }

                boolean certificatSerialNumberOk = (xadesInfoProcessResult.getSigCertExpectedSerialNumber() == null)
                        || (xadesInfoProcessResult.getSigCertExpectedSerialNumber()
                                .equals(xadesInfoProcessResult.getSigCertSerialNumber()));
                boolean certificateIssuerOk = (xadesInfoProcessResult.getSigCertExpectedIssuerName() == null)
                        || (xadesInfoProcessResult.getSigCertExpectedIssuerName().replaceAll(" ", "")
                                .equals(xadesInfoProcessResult.getSigCertIssuerName().replaceAll(" ", "")));
                boolean certificatdigitalSignatureOk = certificatInformation.getSigningCertificate()
                        .getKeyUsage() != null ? certificatInformation.getSigningCertificate().getKeyUsage()[1] : false;
                boolean certificatChainOk = certificatInformation.isSignCertAuthorized();
                boolean certificatChainAutoriseOk = certificatInformation.isAuthorizedCertPath();

                if (!certificateIssuerOk) {
                    certificateIssuerOk = (xadesInfoProcessResult.getSigCertExpectedIssuerName() == null)
                            || (xadesInfoProcessResult.getSigCertExpectedIssuerName().replaceAll(" ", "")
                                    .equals(xadesInfoProcessResult.getSigCertIssuerNameRFC2253().replaceAll(" ", "")));
                }

                boolean certificatBasicConstraintsCritical = certificatInformation.isBasicConstraintCritical();

                boolean xadesProcessOk = verificationResult.getXadesExtractionException() == null;
                boolean xadesSigPolicyHashOk = (xadesInfoProcessResult.getSigExpectedSecurityPolicyIdHash() == null)
                        || (xadesInfoProcessResult.getSigSecurityPolicyIdHash() == null)
                        || (xadesInfoProcessResult.getSigExpectedSecurityPolicyIdHash()
                                .equals(xadesInfoProcessResult.getSigSecurityPolicyIdHash()));
                boolean problemRef = false;
                boolean problemSignedPropertyRef = false;
                for (XMLDsigReference1 ref : listRef) {
                    if (!ref.isVerified()) {
                        problemRef = true;
                    }

                    if (ref.isSignedPropertiesReferenceLookup(simplePesInformation.getPesDocument())) {
                        isSomeSignedPropertyReference = true;
                        if (!ref.isVerified()) {
                            problemSignedPropertyRef = true;
                        }
                    }
                }

                if (!((signatureVerifiedOk) && (isSomeSignedPropertyReference) && (certificatProcessOk)
                        && (certificatSerialNumberOk) && (certificateIssuerOk) && (certificateConfianceOk)
                        && ((certificatdigitalSignatureOk) || (!certificatBasicConstraintsCritical))
                        && (certificatHashOk) && (certificatChainOk) && (certificatChainAutoriseOk) && (mainC14Ok)
                        && (allrefsC14Ok))) {
                    signatureValidation.setValid(false);
                    signatureValidation.getSignatureValidationErrors()
                            .add(SignatureValidationError.SIGNATURE_CONTROL_ERRORS);
                }

                if (certificatProcessOk) {
                    if ((certificateConfianceOk)
                            && ((certificatdigitalSignatureOk) || (!certificatBasicConstraintsCritical))
                            && (certificatChainOk) && (certificatChainAutoriseOk)) {
                        if ((!certificatdigitalSignatureOk) && (!certificatBasicConstraintsCritical)) {
                            signatureValidation.getSignatureValidationErrors()
                                    .add(SignatureValidationError.WRONG_CERTIFICATE);
                        }
                    } else {
                        signatureValidation.getSignatureValidationErrors()
                                .add(SignatureValidationError.UNTRUSTED_CERTIFICATE);
                    }

                } else {
                    signatureValidation.getSignatureValidationErrors()
                            .add(SignatureValidationError.CERTIFICAT_RECOGNITION_ERROR);
                }

                if ((!mainC14Ok) || (!allrefsC14Ok)) {
                    signatureValidation.getSignatureValidationErrors()
                            .add(SignatureValidationError.RECOMMENDATION_NOT_RESPECTED);
                }

                if (xadesProcessOk) {
                    if (!isSomeSignedPropertyReference) {
                        signatureValidation.getSignatureValidationErrors().add(SignatureValidationError.XADES_UNSIGNED);
                    }

                    if (problemSignedPropertyRef) {
                        signatureValidation.getSignatureValidationErrors().add(SignatureValidationError.XADES_UPDATED);
                    }

                    if (!((xadesSigPolicyHashOk) && (certificatSerialNumberOk) && (certificateIssuerOk)
                            && (certificatHashOk))) {
                        signatureValidation.getSignatureValidationErrors().add(SignatureValidationError.XADES_ERROR);
                    }

                    Date date = verificationResult.getXadesInfo().getSigningTime().getTime();
                    String tmp;
                    if (date != null) {
                        SimpleDateFormat sdf = new SimpleDateFormat("dd/MM/yyyy HH:mm:ss");
                        tmp = sdf.format(date);
                    } else {
                        tmp = null;
                    }

                    if (tmp != null) {
                        if (!DateUtils.isStrictUtcFormat(verificationResult.getXadesInfo().getSigningTimeAsString())) {
                            signatureValidation.getSignatureValidationErrors()
                                    .add(SignatureValidationError.DATE_FORMAT_ERROR);
                        }
                    } else {
                        signatureValidation.getSignatureValidationErrors().add(SignatureValidationError.DATE_BLANK);
                    }

                    if (verificationResult.getXadesInfo().getSigClaimedRole() == null) {
                        signatureValidation.getSignatureValidationErrors().add(SignatureValidationError.ROLE_BLANK);
                    }

                    String tmp1 = verificationResult.getXadesInfo().getSigPolicyId();

                    SigningPolicy1 signingPolicy = verificationResult.getXadesInfoProcessResult().getSigningPolicy();
                    if (signingPolicy != null) {

                        if ((tmp1 == null) || (tmp1.isEmpty())) {
                            signatureValidation.getSignatureValidationErrors()
                                    .add(SignatureValidationError.POLICY_ID_MISSING);
                        }

                        String hv = verificationResult.getXadesInfo().getSigPolicyHashDigestValue();
                        if (hv == null) {
                            signatureValidation.getSignatureValidationErrors().add(SignatureValidationError.NO_POLICY);

                        }

                        String spq = verificationResult.getXadesInfo().getSigPolicyQualifier();
                        if (spq == null) {
                            signatureValidation.getSignatureValidationErrors()
                                    .add(SignatureValidationError.POLICY_QUALIFIER_MISSING);
                        }

                    }
                } else {
                    if (verificationResult.getXadesExtractionException() != null) {

                        signatureValidation.getSignatureValidationErrors()
                                .add(SignatureValidationError.XADES_EXCEPTION);

                    }
                    if (!isSomeSignedPropertyReference) {
                        signatureValidation.getSignatureValidationErrors().add(SignatureValidationError.XADES_UNSIGNED);
                    }
                }

            }
        }
        return signatureValidation;
    }

    public ResponseEntity<Document> addFileToclasseur(LocalAuthority localauthority, byte[] file, String fileName,
            int classeur) {

        LinkedMultiValueMap<String, Object> map = new LinkedMultiValueMap<String, Object>();

        map.add("name", fileName);
        map.add("filename", fileName);

        ByteArrayResource contentsAsResource = new ByteArrayResource(file) {
            @Override
            public String getFilename() {
                return fileName; // Filename has to be returned in order to be able to post.
            }
        };

        map.add("file", contentsAsResource);
        HttpHeaders headers = new HttpHeaders();
        headers.addAll(getHeaders(localauthority));
        headers.setContentType(MediaType.MULTIPART_FORM_DATA);

        HttpEntity<LinkedMultiValueMap<String, Object>> requestEntity = new HttpEntity<>(map, headers);
        return restTemplate.exchange(sesileUrl + "/api/classeur/{classeur}/newDocuments", HttpMethod.POST,
                requestEntity, Document.class, classeur);
    }

    public MultiValueMap<String, String> getHeaders(LocalAuthority localAuthority) {
        MultiValueMap<String, String> headers = new LinkedMultiValueMap<String, String>();
        headers.add("token", localAuthority.getToken());
        headers.add("secret", localAuthority.getSecret());
        return headers;
    }

    public List<ServiceOrganisation> getServiceOrganisations(LocalAuthority localauthority, String profileUuid)
            throws IOException {
        JsonNode profile = externalRestService.getProfile(profileUuid);
        String email = profile.get("agent").get("email").asText();
        HttpEntity<LinkedMultiValueMap<String, Object>> requestEntity = new HttpEntity<>(getHeaders(localauthority));
        List<ServiceOrganisation> organisations = Arrays
                .asList(restTemplate.exchange(sesileUrl + "/api/user/services/{email}", HttpMethod.GET, requestEntity,
                        ServiceOrganisation[].class, email).getBody());
        List<ClasseurType> types = Arrays.asList(getTypes(localauthority).getBody());
        organisations.forEach(organisation -> {
            organisation.setTypes(types.stream().filter(type -> organisation.getType_classeur().contains(type.getId()))
                    .collect(Collectors.toList()));
        });
        return organisations;

    }

    public List<ServiceOrganisation> getServiceGenericOrganisations(LocalAuthority localauthority, String email) {
        HttpEntity<LinkedMultiValueMap<String, Object>> requestEntity = new HttpEntity<>(getHeaders(localauthority));
        List<ServiceOrganisation> organisations = Arrays
                .asList(restTemplate.exchange(sesileUrl + "/api/user/services/{email}", HttpMethod.GET, requestEntity,
                        ServiceOrganisation[].class, email).getBody());

        return organisations;

    }

    public List<ServiceOrganisation> getHeliosServiceOrganisations(LocalAuthority localauthority, String email) {
        HttpEntity<LinkedMultiValueMap<String, Object>> requestEntity = new HttpEntity<>(getHeaders(localauthority));
        List<ServiceOrganisation> organisations = Arrays
                .asList(restTemplate.exchange(sesileUrl + "/api/user/services/{email}", HttpMethod.GET, requestEntity,
                        ServiceOrganisation[].class, email).getBody());
        List<Integer> types = Arrays.asList(getTypes(localauthority).getBody()).stream()
                .filter(type -> type.getNom().equals("Helios")).map(type -> type.getId()).collect(Collectors.toList());

        organisations = organisations.stream()
                .filter(orga -> orga.getType_classeur().stream().anyMatch(type -> types.contains(type)))
                .collect(Collectors.toList());
        return organisations;

    }

    public ResponseEntity<Classeur> checkClasseurStatus(LocalAuthority localAuthority, Integer classeur) {
        HttpEntity<LinkedMultiValueMap<String, Object>> requestEntity = new HttpEntity<>(getHeaders(localAuthority));
        return restTemplate.exchange(sesileUrl + "/api/classeur/{id}", HttpMethod.GET, requestEntity, Classeur.class,
                classeur);
    }

    public boolean checkDocumentSigned(LocalAuthority localAuthority, int document) {
        return getDocument(localAuthority, document).isSigned();
    }

    public Document getDocument(LocalAuthority localAuthority, int document) {
        HttpEntity<LinkedMultiValueMap<String, Object>> requestEntity = new HttpEntity<>(getHeaders(localAuthority));

        return restTemplate
                .exchange(sesileUrl + "/api/document/{id}", HttpMethod.GET, requestEntity, Document.class, document)
                .getBody();
    }

    public byte[] getDocumentBody(LocalAuthority localAuthority, int document)
            throws RestClientException, UnsupportedEncodingException {
        HttpEntity<LinkedMultiValueMap<String, Object>> requestEntity = new HttpEntity<>(getHeaders(localAuthority));

        return restTemplate.exchange(sesileUrl + "/api/document/{id}/content", HttpMethod.GET, requestEntity,
                String.class, document).getBody().getBytes("ISO-8859-1");
    }

    public ResponseEntity<Classeur> postClasseur(LocalAuthority localAuthority, ClasseurRequest classeur) {
        LOGGER.debug(classeur.toString());
        HttpEntity<ClasseurRequest> requestEntity = new HttpEntity<>(classeur, getHeaders(localAuthority));
        return restTemplate.exchange(sesileUrl + "/api/classeur/", HttpMethod.POST, requestEntity, Classeur.class);
    }

    public ResponseEntity<ClasseurType[]> getTypes(LocalAuthority localAuthority) {
        HttpEntity<LinkedMultiValueMap<String, Object>> requestEntity = new HttpEntity<>(getHeaders(localAuthority));
        return restTemplate.exchange(sesileUrl + "/api/classeur/types/", HttpMethod.GET, requestEntity,
                ClasseurType[].class);
    }

    public Pair<StatusType, String> getSignatureStatus(byte[] file) {
        String errorMessage = "";
        StatusType status = StatusType.PENDING_SEND;
        SimplePesInformation simplePesInformation = computeSimplePesInformation(file);

        if (isSigned(simplePesInformation)) {
            SignatureValidation signatureValidation = isValidSignature(simplePesInformation);
            if (!signatureValidation.isValid()) {
                status = StatusType.SIGNATURE_INVALID;
                errorMessage = signatureValidation.getSignatureValidationErrors().stream()
                        .map(error -> localesService.getMessage("fr", "pes", "pes.signature_errors." + error.name()))
                        .collect(Collectors.joining("\n"));
            }
        } else {
            status = StatusType.SIGNATURE_MISSING;
        }
        return new Pair<StatusType, String>(status, errorMessage);

    }

    public Optional<GenericDocument> getGenericDocument(Integer fluxId) {
        return genericDocumentRepository.findById(fluxId);
    }

    public GenericDocument saveGenericDocument(GenericDocument genericDocument) {
        return genericDocumentRepository.save(genericDocument);
    }

    @Override
    public void onApplicationEvent(@NotNull PesHistoryEvent event) {
        if (StatusType.CREATED.equals(event.getPesHistory().getStatus())) {
            PesAller pes = pesService.getByUuid(event.getPesHistory().getPesUuid());
            boolean sesileSubscription = pes.getLocalAuthority().getSesileSubscription();
            if (pes.isPj()) {
                pesService.updateStatus(pes.getUuid(), StatusType.PENDING_SEND);
            } else if (!sesileSubscription) {
                Pair<StatusType, String> signatureResult = getSignatureStatus(pes.getAttachment().getFile());
                pes.setSigned(signatureResult.component1().equals(StatusType.PENDING_SEND));
                pesService.save(pes);
                pesService.updateStatus(pes.getUuid(), signatureResult.component1(), signatureResult.component2());
            } else {
                submitToSignature(pes);
            }
        }
    }

}
