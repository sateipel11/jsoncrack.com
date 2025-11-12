import React from "react";
import type { ModalProps } from "@mantine/core";
import {
  Modal,
  Stack,
  Text,
  ScrollArea,
  Flex,
  CloseButton,
  TextInput,
  Button,
  Group,
  ColorInput,
} from "@mantine/core";
import { CodeHighlight } from "@mantine/code-highlight";
import { modify, applyEdits } from "jsonc-parser";
import useFile from "../../../store/useFile";
import useJson from "../../../store/useJson";
import type { NodeData } from "../../../types/graph";
import useGraph from "../../editor/views/GraphView/stores/useGraph";

// return object from json removing array and object fields
const normalizeNodeData = (nodeRows: NodeData["text"]) => {
  if (!nodeRows || nodeRows.length === 0) return "{}";
  if (nodeRows.length === 1 && !nodeRows[0].key) return `${nodeRows[0].value}`;

  const obj = {};
  nodeRows?.forEach(row => {
    if (row.type !== "array" && row.type !== "object") {
      if (row.key) obj[row.key] = row.value;
    }
  });
  return JSON.stringify(obj, null, 2);
};

// return json path in the format $["customer"]
const jsonPathToString = (path?: NodeData["path"]) => {
  if (!path || path.length === 0) return "$";
  const segments = path.map(seg => (typeof seg === "number" ? seg : `"${seg}"`));
  return `$[${segments.join("][")}]`;
};

export const NodeModal = ({ opened, onClose }: ModalProps) => {
  const nodeData = useGraph(state => state.selectedNode);
  const json = useJson(state => state.json);
  const setJson = useJson(state => state.setJson);

  const [editing, setEditing] = React.useState(false);
  const [nameValue, setNameValue] = React.useState<string>("");
  const [colorValue, setColorValue] = React.useState<string>("");

  React.useEffect(() => {
    if (!nodeData) return;
    // initialize local fields from nodeData when modal opens or selection changes
    const nameRow = nodeData.text.find(r => String(r.key).toLowerCase() === "name");
    const colorRow = nodeData.text.find(r => String(r.key).toLowerCase() === "color");
    setNameValue(nameRow && nameRow.value != null ? String(nameRow.value) : "");
    setColorValue(colorRow && colorRow.value != null ? String(colorRow.value) : "");
  }, [nodeData, opened]);

  return (
    <Modal size="auto" opened={opened} onClose={onClose} centered withCloseButton={false}>
      <Stack pb="sm" gap="sm">
        <Stack gap="xs">
          <Flex justify="space-between" align="center">
            <Text fz="xs" fw={500}>
              Content
            </Text>
            <Group>
              {!editing ? (
                <Button size="xs" variant="subtle" onClick={() => setEditing(true)}>
                  Edit
                </Button>
              ) : (
                <>
                  <Button
                    size="xs"
                    color="green"
                    onClick={async () => {
                      if (!nodeData) return;

                      try {
                        let updated = json ?? "";

                        const basePath = nodeData.path ?? [];

                        // update name if changed
                        if (typeof nameValue === "string") {
                          const namePath = [...basePath, "name"];
                          const edits = modify(updated, namePath as any, nameValue, {
                            formattingOptions: { insertSpaces: true, tabSize: 2 },
                          });
                          updated = applyEdits(updated, edits);
                        }

                        // update color if changed
                        if (typeof colorValue === "string") {
                          const colorPath = [...basePath, "color"];
                          const edits = modify(updated, colorPath as any, colorValue, {
                            formattingOptions: { insertSpaces: true, tabSize: 2 },
                          });
                          updated = applyEdits(updated, edits);
                        }

                        // persist updated json and refresh graph
                        setJson(updated);

                        // update the left-side editor contents so the code view reflects the change
                        try {
                          useFile.getState().setContents({
                            contents: updated,
                            hasChanges: false,
                            skipUpdate: true,
                          });
                        } catch (e) {
                          // ignore
                        }

                        // set selected node to the updated node so UI reflects changes
                        try {
                          const nodes = useGraph.getState().nodes;
                          const targetPath = nodeData.path ?? [];
                          const matched = nodes.find(
                            n => JSON.stringify(n.path) === JSON.stringify(targetPath)
                          );
                          if (matched) useGraph.getState().setSelectedNode(matched);
                        } catch (e) {
                          // ignore selection update failures
                        }

                        setEditing(false);
                      } catch (err) {
                        // if something goes wrong, just stop editing
                        setEditing(false);
                      }
                    }}
                  >
                    Save
                  </Button>
                  <Button size="xs" variant="outline" onClick={() => setEditing(false)}>
                    Cancel
                  </Button>
                </>
              )}

              <CloseButton onClick={onClose} />
            </Group>
          </Flex>

          {!editing ? (
            <>
              <ScrollArea.Autosize mah={250} maw={600}>
                <CodeHighlight
                  code={normalizeNodeData(nodeData?.text ?? [])}
                  miw={350}
                  maw={600}
                  language="json"
                  withCopyButton
                />
              </ScrollArea.Autosize>
              <Text fz="xs" fw={500}>
                JSON Path
              </Text>
              <ScrollArea.Autosize maw={600}>
                <CodeHighlight
                  code={jsonPathToString(nodeData?.path)}
                  miw={350}
                  mah={250}
                  language="json"
                  copyLabel="Copy to clipboard"
                  copiedLabel="Copied to clipboard"
                  withCopyButton
                />
              </ScrollArea.Autosize>
            </>
          ) : (
            <Stack gap="xs">
              <Text fz="xs" fw={500}>
                Name
              </Text>
              <TextInput value={nameValue} onChange={e => setNameValue(e.target.value)} />

              <Text fz="xs" fw={500}>
                Color
              </Text>
              <ColorInput
                value={colorValue}
                onChange={val => setColorValue(val)}
                withEyeDropper={false}
              />
            </Stack>
          )}
        </Stack>
        <Text fz="xs" fw={500}>
          JSON Path
        </Text>
        <ScrollArea.Autosize maw={600}>
          <CodeHighlight
            code={jsonPathToString(nodeData?.path)}
            miw={350}
            mah={250}
            language="json"
            copyLabel="Copy to clipboard"
            copiedLabel="Copied to clipboard"
            withCopyButton
          />
        </ScrollArea.Autosize>
      </Stack>
    </Modal>
  );
};
