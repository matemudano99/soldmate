package com.soldmate.config;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.scheduling.annotation.EnableAsync;
import org.springframework.scheduling.concurrent.ThreadPoolTaskExecutor;

import java.util.concurrent.Executor;

/**
 * Habilita procesamiento asíncrono en segundo plano (otro hilo del pool) para tareas
 * que no deben bloquear la respuesta HTTP — encaje con PSP / servicios concurrentes.
 */
@Configuration
@EnableAsync
public class AsyncConfiguration {

    public static final String SOLDMATE_ASYNC_EXECUTOR = "soldmateAsyncExecutor";

    @Bean(name = SOLDMATE_ASYNC_EXECUTOR)
    public Executor soldmateAsyncExecutor() {
        ThreadPoolTaskExecutor executor = new ThreadPoolTaskExecutor();
        executor.setCorePoolSize(2);
        executor.setMaxPoolSize(6);
        executor.setQueueCapacity(200);
        executor.setThreadNamePrefix("soldmate-async-");
        executor.setWaitForTasksToCompleteOnShutdown(true);
        executor.setAwaitTerminationSeconds(20);
        executor.initialize();
        return executor;
    }
}
