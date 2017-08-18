package fr.sictiam.stela.acteservice.model;

public enum StatusType {
    CREATED,
    ARCHIVE_CREATED,
    ANTIVIRUS_OK,
    ANTIVIRUS_KO,
    SENT,
    NOT_SENT,
    ACK_RECEIVED,
    NACK_RECEIVED,
    CANCELLATION_ASKED,
    CANCELLATION_ARCHIVE_CREATED,
    FILE_ERROR
}
