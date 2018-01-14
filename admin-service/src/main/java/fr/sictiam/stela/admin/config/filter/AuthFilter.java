package fr.sictiam.stela.admin.config.filter;

import java.io.IOException;
import java.util.Optional;

import javax.servlet.FilterChain;
import javax.servlet.ServletException;
import javax.servlet.http.HttpServletRequest;
import javax.servlet.http.HttpServletResponse;

import org.apache.commons.lang3.StringUtils;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;

import fr.sictiam.stela.admin.model.Agent;
import fr.sictiam.stela.admin.model.Profile;
import fr.sictiam.stela.admin.service.AgentService;
import fr.sictiam.stela.admin.service.ProfileService;
import io.jsonwebtoken.Jwts;

@Component
public class AuthFilter extends OncePerRequestFilter {

    @Autowired
    AgentService agentService;

    @Autowired
    ProfileService profileService;
    
    @Value("${application.jwt.secret}")
    String SECRET;

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain filterChain)
            throws ServletException, IOException {

        JsonNode token =getToken(request);
                
        Profile profile = null;

        if (token != null && StringUtils.isNotBlank(token.get("uuid").asText())) {
            profile = profileService.getByUuid(token.get("uuid").asText());
        }
        
        if (profile != null) {
            request.setAttribute("STELA-Current-Profile", profile.getUuid());
            request.setAttribute("STELA-Sub", profile.getAgent().getSub());
            request.setAttribute("STELA-Current-Local-Authority-UUID", profile.getLocalAuthority().getUuid());
        }

        filterChain.doFilter(request, response);
    }

    
    JsonNode getToken(HttpServletRequest request) throws IOException {
        String token = request.getHeader("STELA-Active-Token");
        if (token != null) {
            // parse the token.
            String tokenParsed = Jwts.parser().setSigningKey(SECRET).parseClaimsJws(token).getBody().getSubject();

            ObjectMapper objectMapper = new ObjectMapper();
            JsonNode node = objectMapper.readTree(tokenParsed);

            return node;

        }
        return null;
    }
}
