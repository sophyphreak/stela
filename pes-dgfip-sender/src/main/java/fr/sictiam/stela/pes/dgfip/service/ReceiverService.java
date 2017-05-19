package fr.sictiam.stela.pes.dgfip.service;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.amqp.core.ExchangeTypes;
import org.springframework.amqp.core.Message;
import org.springframework.amqp.rabbit.annotation.Exchange;
import org.springframework.amqp.rabbit.annotation.Queue;
import org.springframework.amqp.rabbit.annotation.QueueBinding;
import org.springframework.amqp.rabbit.annotation.RabbitListener;
import org.springframework.stereotype.Service;

@Service
public class ReceiverService {

    private static final Logger LOGGER = LoggerFactory.getLogger(ReceiverService.class);

    @RabbitListener(bindings = @QueueBinding(
            value = @Queue,
            exchange = @Exchange(value = "${spring.application.exchange2}", type = ExchangeTypes.FANOUT,durable="true")))
    public void processIncomingPes(Message message) {
        LOGGER.debug("Received a message PES : {}", message.toString());
        LOGGER.debug("\twith body : {}", new String(message.getBody()));
    }
}
