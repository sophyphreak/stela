package fr.sictiam.stela.acteservice.model;

public enum StatusType {
    CREATED ("CREATED"),
    ARCHIVE_CREATED ("ARCHIVE_CREATED"),
    ANTIVIRUS_OK ("ANTIVIRUS_OK"),
    ANTIVIRUS_KO ("ANTIVIRUS_KO"),
    SENT ("SENT"),
    NOT_SENT ("NOT_SENT"),
    ACK_RECEIVED ("ACK_RECEIVED"),
    NACK_RECEIVED ("NACK_RECEIVED"),
    CANCELLATION_ASKED ("CANCELLATION_ASKED"),
    CANCELLATION_ARCHIVE_CREATED ("CANCELLATION_ARCHIVE_CREATED"),
    CANCELLED ("CANCELLED"),
    ARCHIVE_TOO_LARGE ("ARCHIVE_TOO_LARGE"),
    ARCHIVE_SIZE_CHECKED ("ARCHIVE_SIZE_CHECKED"),
    FILE_ERROR ("FILE_ERROR"),
    NOTIFICATION_SENT ("NOTIFICATION_SENT"),;

    final String name;

    StatusType(String s) {
        name = s;
    }

    @Override
    public String toString() {
        return this.name;
    }
}
