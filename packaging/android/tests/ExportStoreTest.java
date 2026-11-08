package io.github.itsnold.fcdroid;

import java.io.File;
import java.io.IOException;
import java.nio.file.Files;
import java.util.Arrays;

/** Standalone JVM regressions, no additional test-framework dependency. Run with -ea. */
public final class ExportStoreTest {
    interface Throwing { void run() throws Exception; }
    private static void rejects(Throwing action) throws Exception {
        try { action.run(); } catch (IOException expected) { return; }
        throw new AssertionError("Expected an IOException");
    }

    public static void main(String[] args) throws Exception {
        File directory = Files.createTempDirectory("fcdroid-export-test-").toFile();
        try (ExportStore store = new ExportStore(directory)) {
            store.begin("../../test.fcproj", "application/json", 5);
            store.append(new byte[]{1, 2}); store.append(new byte[]{3, 4, 5}); store.finish();
            assert store.peek().name().equals("test.fcproj");
            assert Arrays.equals(new byte[]{1, 2, 3, 4, 5}, Files.readAllBytes(store.peek().file().toPath()));
            File file = store.peek().file(); store.discardFirst(); assert !file.exists();
            rejects(() -> store.begin("a", "x/y", -1));
            rejects(() -> store.begin("a", "x/y", ExportStore.MAX_BYTES + 1));
            store.begin("a", "x/y", 4); store.append(new byte[]{1});
            rejects(store::finish); assert store.peek() == null;
            rejects(() -> store.append(new byte[4])); store.abort();
            assert directory.list().length == 0;
            rejects(() -> store.append(new byte[0])); rejects(store::finish);
            store.begin("a", "x/y", ExportStore.MAX_CHUNK + 1);
            rejects(() -> store.append(new byte[ExportStore.MAX_CHUNK + 1]));
            rejects(() -> store.begin("b", "x/y", 0)); store.abort();
            for (int i = 0; i < ExportStore.MAX_PENDING; i++) { store.begin("a", "x/y", 0); store.finish(); }
            rejects(() -> store.begin("a", "x/y", 0));
        } finally {
            assert directory.list().length == 0;
            assert directory.delete();
        }
        assert ExportStore.safeName("..").equals("export.bin");
        assert ExportStore.safeName(null).equals("export.bin");
        assert ExportStore.safeName("C:\\dir\\render.mp4").equals("render.mp4");
        assert ExportStore.safeName("line\nname").equals("line_name");
        assert ExportStore.safeMime("video/mp4\r\nBad: value").equals("application/octet-stream");
        assert ExportStore.safeMime("image/png").equals("image/png");
        System.out.println("ExportStore: chunk integrity, bounds, queue, cleanup and name/MIME safety passed");
    }
}
