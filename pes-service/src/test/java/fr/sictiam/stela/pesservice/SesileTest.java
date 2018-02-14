package fr.sictiam.stela.pesservice;

import fr.sictiam.stela.pesservice.model.SesileConfiguration;
import fr.sictiam.stela.pesservice.model.sesile.Classeur;
import fr.sictiam.stela.pesservice.model.sesile.ClasseurRequest;
import fr.sictiam.stela.pesservice.model.sesile.ClasseurStatus;
import fr.sictiam.stela.pesservice.model.sesile.Document;
import fr.sictiam.stela.pesservice.service.SesileService;
import org.junit.Before;
import org.junit.Test;
import org.springframework.core.io.ClassPathResource;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.test.util.ReflectionTestUtils;

import java.io.InputStream;

import static org.hamcrest.CoreMatchers.is;
import static org.hamcrest.CoreMatchers.notNullValue;
import static org.junit.Assert.assertThat;

public class SesileTest {

    SesileService sesileService = new SesileService(null, null, null);

    SesileConfiguration sesileConfiguration;

    @Before
    public void beforeTests() {

        sesileConfiguration = new SesileConfiguration();

        sesileConfiguration.setToken("token_26686e906f40248f284f013e37700091");
        sesileConfiguration.setSecret("secret_52491818dd846ccd4580a16cfd7736dc");

        ReflectionTestUtils.setField(sesileService, "sesileUrl", "https://demo.sesile.fr/");
    }

    @Test
    public void testAddFileToclasseur() throws Exception {
        InputStream in = new ClassPathResource("data/28000-2017-P-RN-22-1516807373820.xml").getInputStream();

        byte[] targetArray = new byte[in.available()];
        in.read(targetArray);

        ResponseEntity<Document> retour = sesileService.addFileToclasseur(sesileConfiguration, targetArray,
                "28000-2017-P-RN-22-1516807373820", 2891);
        // {"id":2894,"name":"28000-2017-P-RN-22-1516807373820","repourl":"5a831da0334e6.","type":"application\/xml","signed":false,"histories":[]}
        assertThat(retour, notNullValue());
        assertThat(retour.getStatusCodeValue(), is(HttpStatus.OK.value()));
    }

    @Test
    public void testCheckClasseurStatus() {
        ResponseEntity<Classeur> classeur = sesileService.checkClasseurStatus(sesileConfiguration, 2891);
        assertThat(classeur, notNullValue());
        assertThat(classeur.getStatusCodeValue(), is(HttpStatus.OK.value()));
        assertThat(classeur.getBody().getStatus(), is(ClasseurStatus.IN_PROGRESS));
    }

    @Test
    public void testPostClasseur() throws Exception {
        ResponseEntity<Classeur> classeur = sesileService.postClasseur(sesileConfiguration,
                new ClasseurRequest("test", "test", "20/02/2018", 2, 1, 3, "f.laussinot@sictiam.fr"));
        assertThat(classeur, notNullValue());
        assertThat(classeur.getStatusCodeValue(), is(HttpStatus.OK.value()));
    }

}
