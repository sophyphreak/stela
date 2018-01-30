package fr.sictiam.stela.admin.controller;

import java.util.List;

import org.apache.commons.beanutils.BeanUtils;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import com.fasterxml.jackson.annotation.JsonView;

import fr.sictiam.stela.admin.model.Profile;
import fr.sictiam.stela.admin.model.UI.ProfileUI;
import fr.sictiam.stela.admin.model.UI.Views;
import fr.sictiam.stela.admin.service.ProfileService;

@RestController
@RequestMapping("/api/admin/profile")
public class ProfileController {

    private static final Logger LOGGER = LoggerFactory.getLogger(ProfileController.class);

    private final ProfileService profileService;

    public ProfileController(ProfileService profileService) {
        this.profileService = profileService;
    }

    @PutMapping("/{uuid}/group")
    public void updateGroups(@PathVariable String uuid, @RequestBody List<String> groupUuids) {
        profileService.updateGroups(uuid, groupUuids);
    }

    @GetMapping
    @JsonView(Views.ProfileView.class)
    public Profile getCurrentProfile(@RequestAttribute("STELA-Current-Profile") String profile) {
        return profileService.getByUuid(profile);
    }
    
    @GetMapping("/{uuid}")
    @JsonView(Views.ProfileView.class)
    public Profile getCurrentProfileByUuid(@PathVariable String uuid) {
        return profileService.getByUuid(uuid);
    }

    @GetMapping("/{uuid}/slug")
    public String getSlugForProfile(@PathVariable String uuid) {
        return profileService.getByUuid(uuid).getLocalAuthority().getSlugName();
    }

    @PatchMapping("/{uuid}")
    public ResponseEntity updateProfile(@PathVariable String uuid, @RequestBody ProfileUI profileUI) {
        Profile profile = profileService.getByUuid(uuid);
        try {
            BeanUtils.copyProperties(profile, profileUI);
        } catch (Exception e) {
            LOGGER.error("Error while updating properties: {}", e);
            return new ResponseEntity(HttpStatus.INTERNAL_SERVER_ERROR);
        }
        profileService.createOrUpdate(profile);
        return new ResponseEntity(HttpStatus.OK);
    }
}
