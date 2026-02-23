package com.example;

/**
 * Application configuration holder.
 */
public class AppConfig {
    private int port;
    private String host;

    /**
     * Returns the configured port.
     * @return the port number
     */
    public int getPort() {
        return port;
    }

    public String getHost() {
        return host;
    }
}

public interface UndocumentedService {
    void execute();
}

/**
 * Processes incoming requests.
 */
public class RequestProcessor {
    @Override
    public String toString() {
        return "RequestProcessor";
    }

    public void handleRequest(String payload) {
        System.out.println(payload);
    }
}
